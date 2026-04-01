# ClawHost User Portal & Backend Refactor — Design Spec

## Scope

This spec covers two connected pieces of work:

1. **ClawHost backend refactor** — remove the App tenant layer, add User model with authentication (email/password + OAuth), rename Bot to Agent
2. **User portal** — a Next.js frontend for end users to register, create and manage their OpenClaw agents

The **admin dashboard** is a separate project and will get its own spec after this is built.

Billing is out of scope for this iteration.

## Architecture

```
Browser ──cookie/JWT──▶ Next.js (pure UI, SSR) ──JWT──▶ ClawHost API ──K8s──▶ OpenClaw Pods
```

- **ClawHost API** owns all business logic: authentication, agent CRUD, K8s orchestration, config sync
- **Next.js frontend** is a stateless UI layer. It stores no user data. All state comes from ClawHost API calls. It runs as a separate process/deployment.
- **Authentication** is handled entirely by ClawHost. The frontend stores the JWT in an httpOnly cookie and passes it to ClawHost on every API call.

### Why authentication lives in ClawHost (not the frontend)

The backend refactor already replaces the App model with a User model and rewrites auth middleware. Putting auth in ClawHost keeps the data model and access control in one place, avoids duplicating user storage, and lets any future client (mobile app, CLI, third-party integrations) authenticate against the same API.

## Data Model Changes

### Removed: `apps` table

The App model and all associated code (handler, middleware, admin endpoints) are deleted. The `app_id` foreign key on bots is replaced by `user_id`.

### New: `users` table

| Column | Type | Notes |
|--------|------|-------|
| id | varchar(36) PK | UUID |
| email | varchar(255) UNIQUE | Required |
| password_hash | varchar(255) | bcrypt, nullable for OAuth-only users |
| name | varchar(255) | Display name |
| avatar | varchar(500) | URL, nullable |
| oauth_provider | varchar(50) | "github", "google", nullable |
| oauth_id | varchar(255) | Provider's user ID, nullable |
| role | varchar(20) | "user" or "admin", default "user" |
| status | varchar(20) | "active" or "disabled", default "active" |
| api_token | varchar(64) | For programmatic API access (optional, generated on demand) |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Unique constraint on `(oauth_provider, oauth_id)` where both are non-null.

### New: `refresh_tokens` table

| Column | Type | Notes |
|--------|------|-------|
| id | varchar(36) PK | UUID |
| user_id | varchar(36) FK | → users.id |
| token_hash | varchar(255) | SHA-256 hash of the refresh token |
| expires_at | timestamptz | |
| created_at | timestamptz | |

Expired tokens are cleaned up periodically or on login.

### Renamed: `bots` → `agents` table

| Column | Change |
|--------|--------|
| table name | `bots` → `agents` |
| app_id | **deleted** |
| user_id | Changed from a bare string to FK → `users.id` |

All other columns stay the same: id, name, slug, access_token, status, config (JSONB), endpoint, expires_at, created_at, updated_at.

### Migration

A database migration renames the table and drops the `app_id` column. Existing bots will need their `user_id` values mapped to real user records. For the initial deployment, a CLI command (`./clawhost migrate-users`) can create user records from distinct `user_id` values in the old bots table.

## Authentication

### JWT tokens

- **Access token**: short-lived (15 minutes), contains `{user_id, email, role}`, signed with a configurable secret (`auth.jwt_secret` in config.toml)
- **Refresh token**: long-lived (7 days), stored in database (a `refresh_tokens` table with user_id, token_hash, expires_at), returned as httpOnly cookie
- Token refresh is transparent to the frontend

### Password auth

- Passwords hashed with bcrypt (cost 10)
- Email verification is out of scope for v1 (can be added later)

### OAuth

- Supported providers: GitHub, Google
- Flow: frontend redirects to `GET /auth/oauth/github` → ClawHost redirects to GitHub → callback at `GET /auth/oauth/github/callback` → ClawHost creates/finds user → returns JWT
- OAuth config via config.toml:

```toml
[auth]
jwt_secret = "your-secret-key"

[auth.oauth.github]
client_id = ""
client_secret = ""

[auth.oauth.google]
client_id = ""
client_secret = ""
```

### Admin promotion

No separate admin token. Admins are users with `role = "admin"`. First admin is created via CLI:

```bash
./clawhost admin promote user@example.com
```

## API Routes

### Auth (no authentication required)

| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/register | Create account (email, password, name) → JWT |
| POST | /auth/login | Authenticate (email, password) → JWT |
| POST | /auth/refresh | Refresh access token |
| GET | /auth/oauth/:provider | Redirect to OAuth provider |
| GET | /auth/oauth/:provider/callback | OAuth callback → JWT |

### User (JWT required)

| Method | Path | Description |
|--------|------|-------------|
| GET | /auth/me | Current user profile |
| PUT | /auth/me | Update profile (name, avatar) |
| PUT | /auth/me/password | Change password |

### Agents (JWT required, replaces /bot/api/v1/bots)

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/agents | Create agent |
| GET | /api/v1/agents | List user's agents |
| GET | /api/v1/agents/:id | Get agent |
| PUT | /api/v1/agents/:id | Update agent |
| DELETE | /api/v1/agents/:id | Delete agent (stops K8s resources first) |
| POST | /api/v1/agents/:id/start | Start agent |
| POST | /api/v1/agents/:id/stop | Stop agent |
| POST | /api/v1/agents/:id/restart | Restart agent |
| GET | /api/v1/agents/:id/status | Get agent status |
| GET | /api/v1/agents/:id/connect | Get connection info |
| POST | /api/v1/agents/:id/reset-token | Reset access token |

Sub-routes (channels, skills, devices, config) keep their existing structure under `/api/v1/agents/:id/`.

### Admin (JWT required, role = admin)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/admin/users | List all users |
| PUT | /api/v1/admin/users/:id | Update user (role, status) |
| GET | /api/v1/admin/agents | List all agents across users |
| POST | /api/v1/admin/agents/upgrade | Upgrade all agents |
| POST | /api/v1/admin/agents/:id/upgrade | Upgrade specific agent |
| GET | /api/v1/admin/stats | System stats (user count, agent count, running count) |

### Proxy (unchanged)

`/proxy/:agent_id/*` — resolves agent by UUID or slug, proxies to K8s Service. No auth change needed here; the proxy uses the agent's `access_token` for bot-level auth.

## Middleware Changes

| Current | New | Logic |
|---------|-----|-------|
| `BearerAuth` | `JWTAuth` | Parse JWT from Authorization header, validate signature, extract user, store in context |
| `BotOwnerAuth` | `AgentOwnerAuth` | Check `agent.user_id == context_user.id` |
| `AdminAuth` (config token) | `AdminAuth` (role check) | Check `context_user.role == "admin"` |

## User Portal (Next.js)

### Tech stack

- Next.js 14+ (App Router)
- React Server Components for data fetching
- Tailwind CSS for styling
- shadcn/ui for component library

### Pages

| Route | Description |
|-------|-------------|
| /login | Email/password form + OAuth buttons (GitHub, Google) |
| /register | Name, email, password form |
| /forgot-password | Password reset (v2, not in initial build) |
| /dashboard | Agent card grid with status, model, quick actions |
| /agents/new | Create agent form: name, slug, model provider + API key |
| /agents/[id] | Agent detail with tabs |
| /agents/[id]#overview | Status, endpoint, access token, WebUI link |
| /agents/[id]#config | Model providers, agent defaults |
| /agents/[id]#channels | IM channel management |
| /agents/[id]#skills | Skill CRUD |
| /agents/[id]#devices | Device pairing management |
| /settings | User profile, password change, API token |

### Auth flow in the frontend

1. Login/register pages call ClawHost `/auth/*` endpoints
2. JWT access token stored in httpOnly cookie (set by Next.js API route)
3. All page data fetched via Server Components calling ClawHost API with the JWT
4. Token refresh handled by a Next.js middleware that checks expiry before each request

### Agent WebUI access

When a user clicks "Open WebUI", the frontend redirects to the agent's proxy URL with the access_token as a query parameter:

```
https://{slug}.{domain}?token={access_token}
```

This is the existing proxy auth mechanism and doesn't change.

## Backend File Changes

### New files (~3)

- `model/user.go` — User model, GORM operations, password hashing
- `handler/api/v1/auth.go` — Register, login, OAuth, profile endpoints
- `middleware/jwt.go` — JWT validation middleware, token generation helpers

### Modified files (~15)

- `cmd/server.go` — New route groups (/auth/*, rename /bot/api/v1 to /api/v1)
- `cmd/root.go` — Add `admin promote` CLI command
- `middleware/auth.go` — Replace BearerAuth/BotOwnerAuth with JWTAuth/AgentOwnerAuth
- `model/bot.go` → `model/agent.go` — Rename struct, remove app_id, add FK
- `handler/api/v1/bot_*.go` → `handler/api/v1/agent_*.go` — Rename files and functions
- `handler/proxy/proxy.go` — Update model references (Bot → Agent)
- `service/k8s/deployment.go` — Update function signatures and references
- `service/k8s/config_sync.go` — Update model references
- `service/k8s/*.go` — Update remaining bot references
- `util/config.go` — Add auth config section

### Deleted files (~2)

- `model/app.go` — App model removed entirely
- `handler/api/v1/app.go` — App CRUD handlers removed

## Configuration Changes

```toml
# New section in config.toml
[auth]
jwt_secret = "change-me-to-a-random-string"
jwt_access_ttl = "15m"
jwt_refresh_ttl = "168h"   # 7 days

[auth.oauth.github]
client_id = ""
client_secret = ""
callback_url = "http://localhost:18080/auth/oauth/github/callback"

[auth.oauth.google]
client_id = ""
client_secret = ""
callback_url = "http://localhost:18080/auth/oauth/google/callback"

# Removed
# [api]
# admin_token = "..."
# token = "..."
```

## What This Spec Does NOT Cover

- **Admin dashboard UI** — separate spec, built after user portal
- **Billing / usage limits** — future iteration
- **Email verification** — can be added later without model changes
- **Password reset flow** — v2
- **Rate limiting** — should be added but is a separate concern
- **Backwards compatibility** — this is a breaking change to the API; no migration path for existing API consumers is provided (acceptable for pre-1.0)
