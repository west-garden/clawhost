# ClawHost Portal Frontend — Design Spec

## Scope

A Next.js user portal for ClawHost, living inside the existing monorepo at `portal/`. Lets non-technical users register, create AI agents with one click, and manage them (start/stop, view connections, connect IM channels). Admin dashboard is out of scope. Billing is out of scope.

## Architecture

```
Browser ──httpOnly cookie──▶ Next.js BFF (API Routes) ──JWT──▶ ClawHost API ──K8s──▶ OpenClaw Pods
```

- **ClawHost API** (existing Go backend) owns all business logic, auth, K8s orchestration
- **Next.js BFF** is a stateless UI + token management layer. Stores JWT in httpOnly cookies. Browser JS never sees the token.
- **Server Components** fetch data server-side via `lib/api.ts`
- **Client Components** use SWR for real-time polling, call Next.js API Routes (not ClawHost directly)

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Components | shadcn/ui |
| Data fetching (server) | Server Components + Server Actions |
| Data fetching (client) | SWR via Next.js API Routes |
| i18n | next-intl (cookie-based, no URL prefix) |
| Toast | sonner |
| Package manager | pnpm |

## Project Structure

```
clawhost/
├── portal/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/              # No-sidebar layout group
│   │   │   │   ├── login/page.tsx
│   │   │   │   ├── register/page.tsx
│   │   │   │   └── layout.tsx        # Centered card layout
│   │   │   ├── (dashboard)/          # Sidebar layout group
│   │   │   │   ├── page.tsx           # Dashboard (agent grid)
│   │   │   │   ├── agents/[id]/page.tsx
│   │   │   │   ├── settings/page.tsx
│   │   │   │   └── layout.tsx         # Sidebar + header layout
│   │   │   ├── auth/
│   │   │   │   └── callback/route.ts  # OAuth callback handler
│   │   │   ├── api/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── login/route.ts
│   │   │   │   │   ├── register/route.ts
│   │   │   │   │   ├── logout/route.ts
│   │   │   │   │   └── oauth/[provider]/route.ts
│   │   │   │   └── agents/
│   │   │   │       └── [id]/
│   │   │   │           └── status/route.ts   # Proxy for SWR polling
│   │   │   ├── layout.tsx             # Root layout (providers, fonts)
│   │   │   └── not-found.tsx
│   │   ├── components/
│   │   │   ├── ui/                    # shadcn/ui (installed on demand)
│   │   │   ├── sidebar.tsx
│   │   │   ├── agent-card.tsx
│   │   │   ├── agent-status-badge.tsx
│   │   │   ├── create-agent-dialog.tsx
│   │   │   ├── channel-list.tsx
│   │   │   ├── wechat-qr-dialog.tsx
│   │   │   ├── telegram-dialog.tsx
│   │   │   ├── confirm-dialog.tsx
│   │   │   └── locale-switcher.tsx
│   │   ├── lib/
│   │   │   ├── api.ts                 # Server-side ClawHost API client
│   │   │   ├── auth.ts               # Cookie read/write helpers
│   │   │   └── utils.ts              # cn() and misc helpers
│   │   ├── hooks/
│   │   │   └── use-agent-status.ts   # SWR hook for polling agent status
│   │   ├── types/
│   │   │   └── index.ts              # Agent, User, Channel types
│   │   └── messages/
│   │       ├── zh.json
│   │       └── en.json
│   ├── public/
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── Dockerfile
```

## Pages & Routes

| Route | Layout | Description |
|-------|--------|-------------|
| `/login` | (auth) | Email/password form + OAuth buttons (GitHub, Google) |
| `/register` | (auth) | Name, email, password form |
| `/` | (dashboard) | Agent card grid + "New Agent" placeholder card |
| `/agents/[id]` | (dashboard) | Agent detail with tabs: Overview, Channels |
| `/settings` | (dashboard) | User profile, change password |

## Layouts

### (auth) Layout

Centered card on a clean background. No sidebar. Used for login and register.

### (dashboard) Layout

```
┌──────────┬──────────────────────────────────┐
│          │  Header (page title + avatar)     │
│  Logo    ├──────────────────────────────────┤
│          │                                  │
│  Agents  │  Content area                    │
│  Settings│                                  │
│          │                                  │
│          │                                  │
│ ──────── │                                  │
│  中/EN   │                                  │
│  Logout  │                                  │
└──────────┴──────────────────────────────────┘
```

- Sidebar: fixed, w-60, collapses to hamburger on mobile
- Sidebar bottom: locale switcher + logout button
- Header right: user avatar/name

## Auth Flow

### Login / Register

```
Browser → POST /api/auth/login (Next.js API Route)
        → POST /auth/login (ClawHost API)
        ← { access_token, refresh_token, user }
        ← Set-Cookie: token=<access_token> (httpOnly, secure, sameSite=lax)
        ← Set-Cookie: refresh=<refresh_token> (httpOnly, secure, sameSite=lax)
        ← { user } (to browser, no tokens)
```

### Token Refresh

Next.js Middleware runs on every request:
1. Read `token` cookie, decode JWT (no signature verification, just read `exp`)
2. If expired or near-expiry (< 1 min), use `refresh` cookie to call ClawHost `POST /auth/refresh`
3. Update both cookies with new tokens
4. If refresh fails, clear cookies and redirect to `/login`

### OAuth

1. Browser clicks "Login with GitHub"
2. `GET /api/auth/oauth/github` (Next.js) → redirects to ClawHost `GET /auth/oauth/github` → GitHub
3. GitHub callback → ClawHost `GET /auth/oauth/github/callback` → redirects to Next.js `/auth/callback?access_token=...&refresh_token=...`
4. `/auth/callback` route handler sets cookies, redirects to `/`

**Requires** ClawHost config `auth.frontend_url` set to the portal's public URL (e.g., `http://localhost:3000`). The Go backend uses this to build the redirect URL in step 3.

### Logout

`POST /api/auth/logout` → clears cookies → redirect to `/login`

## Dashboard Page

### Agent Card Grid

Cards in a responsive grid (1 col mobile, 2 col tablet, 3 col desktop).

Each card shows:
- Status indicator (green dot = running, gray = stopped)
- Agent name
- Connected channels as small icons
- Click → navigate to `/agents/[id]`

Last card in grid is a **"+ New Agent"** placeholder with dashed border.

### Empty State

When user has 0 agents, show centered prompt: "Create your first AI Agent" + button.

### Create Agent Dialog

Triggered by clicking the "+" card. Contains:
- Single text input: Agent name
- Confirm button
- On success: redirect to `/agents/[id]`

Backend assigns default model config automatically. User doesn't configure anything at creation.

## Agent Detail Page

### Overview Tab

- **Status row**: status badge + Start/Stop/Restart buttons
- **Connection info**:
  - WebUI link (clickable, opens in new tab)
  - API Endpoint (copy button)
  - Access Token (masked by default, copy button, reset button with confirmation)
- **Metadata**: created date, slug
- **Danger zone**: Delete Agent button (requires typing agent name to confirm)

### Channels Tab

**Connected channels list**: each row shows channel icon, type name, account info, online status, remove button.

**Add channel section**: cards for WeChat and Telegram.

**WeChat flow**:
1. Click WeChat card → Dialog opens
2. API call to get QR code → display QR image
3. Poll `/channels/wechat/login/status` until success or timeout
4. On success → close dialog, refresh channel list

**Telegram flow**:
1. Click Telegram card → Dialog opens
2. Input field for Bot Token → submit
3. On success → close dialog, refresh channel list

## Data Fetching

| Scenario | Method | Notes |
|----------|--------|-------|
| Dashboard agent list | Server Component | SSR, refresh via `router.refresh()` |
| Agent detail basic info | Server Component | SSR |
| Agent running status | Client + SWR | Poll every 5s via `/api/agents/[id]/status` |
| Start/Stop/Restart | Server Action | Revalidate page data after |
| Channel list | Client + SWR | Only available when agent is running |
| WeChat QR status | Client polling | Until success or timeout |
| Create Agent | Server Action | Redirect to detail on success |
| Login/Register | API Route | Needs to set httpOnly cookies |

### API Client (`lib/api.ts`)

- Server-side only. Reads token from cookies.
- Wraps all ClawHost API calls. Unwraps `{ code, message, data }` → returns `data`.
- 401 → trigger re-login. Other errors → throw with message.

### SWR via API Routes

Client components don't call ClawHost directly. They call Next.js API Routes which proxy to ClawHost with the JWT from cookies.

Example: `GET /api/agents/[id]/status` → reads cookie → `GET /api/v1/agents/:id/status` on ClawHost → returns response.

## i18n

- Library: `next-intl`
- Language preference stored in cookie (`locale=zh`), no URL prefix
- Default language: Chinese (zh)
- Switching: sidebar button toggles cookie + refreshes page
- Translation files: `messages/zh.json`, `messages/en.json`
- Namespace by page/feature: `dashboard.title`, `agent.status.running`, etc.
- Translation keys in English semantic naming

## Error Handling & Loading

### Loading States

- `loading.tsx` per route group provides skeleton screens
- Operation buttons show spinner during async operations
- Dialogs show loading state on submit

### Error Handling

| ClawHost Response | Frontend Behavior |
|-------------------|-------------------|
| 401 Unauthorized | Clear cookies, redirect to `/login` |
| 403 Forbidden | Toast: "No permission" |
| 404 Not Found | Show 404 page |
| Other errors | Toast with error message |

### Operation Feedback

- Start/Stop/Restart: button spinner → poll status → toast result
- Create Agent: submit spinner → redirect to detail page
- Delete Agent: confirmation dialog → spinner → redirect to dashboard + toast
- Channel operations: dialog loading → close dialog + refresh list

### Toast

Using `sonner` (shadcn/ui recommended). Positioned top-right.

## Deployment

Portal runs as a separate Node.js process. Dockerfile based on `node:20-alpine`, multi-stage build:

1. `pnpm install` → `pnpm build` → standalone output
2. Serve via `next start` on a configurable port (default 3000)

In production K8s: separate Deployment + Service, behind the same Ingress as ClawHost API (path-based routing or separate subdomain).

Environment variables:
- `CLAWHOST_API_URL` — internal ClawHost API URL (e.g., `http://clawhost:18080`)
- `NEXT_PUBLIC_APP_URL` — public URL of the portal itself

## What This Spec Does NOT Cover

- **Admin dashboard** — separate spec, built after this
- **Billing / usage limits** — future iteration
- **Email verification** — can be added later
- **Password reset flow** — future iteration
- **Model/Skill/Device management UI** — future tabs on agent detail page
- **Real-time WebSocket updates** — polling is sufficient for v1
- **Dark mode** — can be added later with Tailwind's dark variant
