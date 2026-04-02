# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClawHost is a Kubernetes-native platform for managing and orchestrating [OpenClaw](https://openclaw.ai/) bot instances. It provides a RESTful API to create, deploy, and manage AI agent bots in a multi-tenant environment. Each bot runs as an isolated K8s Deployment + Service with optional ChatClaw sidecar.

## Development Commands

```bash
# Build
go build -o clawhost .

# Run with live reload (requires Air: https://github.com/air-verse/air)
make dev

# Run server directly
./clawhost server

# Docker build
docker build -t clawhost:latest .
```

### Local Development Prerequisites

1. PostgreSQL (via Docker): `docker run -d --name clawhost-pg -e POSTGRES_DB=clawhost -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16`
2. K8s namespace + storage: `kubectl create namespace clawhost && kubectl apply -f deploy/k8s/pvc.yaml`
3. Config: `cp config.example.toml config.toml` — set `kubernetes.local_dev = true` for host access to ClusterIP services

No tests, no linter. Go 1.24+.

## Architecture

### Request Flow

```
Client → Echo (subdomain rewrite middleware) → Route matching → Auth middleware → Handler → K8s service layer → K8s API
```

### Layer Structure

- **`cmd/`** — Cobra CLI commands. `server.go` sets up all Echo routing and the subdomain rewrite middleware (`e.Pre`).
- **`handler/api/v1/`** — One file per endpoint group (e.g., `bot_start.go`, `bot_channel.go`). Handlers retrieve the authenticated app/bot from Echo context set by middleware.
- **`handler/proxy/`** — HTTP/WebSocket reverse proxy to bot pods. Handles session cookies, auto-approval of device pairing, and ChatClaw vs OpenClaw routing.
- **`middleware/`** — `BearerAuth` (app token validation), `BotOwnerAuth` (bot belongs to app), `AdminAuth` (admin token). Stores `*model.App` and `*model.Bot` in Echo context.
- **`service/k8s/`** — All Kubernetes operations. Each bot gets a Deployment (`oc-{first8chars}`) and Service (`oc-{first8chars}-svc`). Config sync between PostgreSQL and pods via `kubectl exec`.
- **`model/`** — GORM models with database operations defined as package-level functions (not a repository layer). Bot config stored as JSONB, with dual representations: `BotConfig` (legacy) and `OpenClawConfig` (native openclaw.json format).
- **`util/`** — Config loading (Viper), DB connection, HTTP response helpers (`util.Success`, `util.BadRequest`, etc.).

### Key Patterns

**Multi-tenancy**: App → Bot ownership. `BearerAuth` validates app token from `apps` table, `BotOwnerAuth` verifies `bot.AppID == app.ID`. Admin endpoints use a separate `AdminAuth` with `api.admin_token` from config.

**Config Sync**: Bot config lives in two places — PostgreSQL (JSONB) and the pod's `/home/node/.openclaw/openclaw.json`. The `config_sync.go` module handles bidirectional sync. `SyncSectionsToPod` does surgical section-level merges (models, channels, agents) via `node -e` inside the pod to preserve JSON key ordering and avoid false hot-reload triggers.

**Subdomain Routing**: `e.Pre` middleware in `server.go` rewrites `{slug}.domain/*` → `/proxy/{slug}/*`. The proxy layer resolves bot by UUID or slug, then reverse-proxies to the K8s Service. WebSocket connections are proxied bidirectionally with NOT_PAIRED auto-approval.

**ChatClaw Sidecar**: When `[chatclaw]` config section is present, each bot pod gets a second container. Non-API/non-WS requests route to ChatClaw port; API paths (`/v1/*`) and WebSocket always route to OpenClaw gateway port.

**Bot Deployment Lifecycle**: `buildDeploymentSpec()` in `deployment.go` is the single source of truth for pod specs. Both `CreateDeployment` and `ReplaceDeployment` use it. The init container sets file permissions, the main container writes `openclaw.json` on first start only (restarts preserve the PVC config).

**Response Format**: All API responses use `util.Response{Code, Message, Data}`. Success returns `{"code": 0, "message": "success", "data": ...}`. Errors return appropriate HTTP status codes.

### Configuration

Config loaded via Viper from `config.toml`. Key sections: `[server]`, `[api]`, `[db]`, `[kubernetes]`, `[storage]`, `[domain]`, `[openclaw]`, and optional `[chatclaw]`. See `config.example.toml` for all options.

## Key Dependencies

Echo v4 (web), Cobra (CLI), Viper (config), GORM + PostgreSQL, client-go (K8s), Gorilla WebSocket (proxy).
