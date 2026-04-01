# ClawHost Portal Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js user portal inside the clawhost monorepo that lets non-technical users register, create AI agents, and manage them (start/stop, channels).

**Architecture:** Next.js BFF pattern — the frontend stores JWT in httpOnly cookies, proxies API calls to ClawHost Go backend server-side. Server Components handle SSR, Client Components use SWR for real-time polling. i18n via next-intl with cookie-based locale (no URL prefix).

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, next-intl, SWR, sonner, pnpm

**Spec:** `docs/superpowers/specs/2026-04-01-portal-frontend-design.md`

**Note:** This project has no tests or linter. Steps focus on implementation and build verification.

---

## File Structure

### New files (in `portal/`)

| File | Responsibility |
|------|---------------|
| `src/types/index.ts` | TypeScript types matching ClawHost API responses |
| `src/lib/utils.ts` | `cn()` helper for Tailwind class merging |
| `src/lib/api.ts` | Server-side ClawHost API client (reads JWT from cookie) |
| `src/lib/auth.ts` | Cookie read/write helpers for token management |
| `src/lib/actions.ts` | Server Actions for agent CRUD and lifecycle operations |
| `src/i18n/config.ts` | Locale list, default locale constants |
| `src/i18n/request.ts` | next-intl request config (reads locale from cookie) |
| `src/messages/zh.json` | Chinese translations |
| `src/messages/en.json` | English translations |
| `src/middleware.ts` | Auth guard + token refresh middleware |
| `src/app/layout.tsx` | Root layout (NextIntlClientProvider, Toaster, fonts) |
| `src/app/not-found.tsx` | 404 page |
| `src/app/(auth)/layout.tsx` | Centered card layout for login/register |
| `src/app/(auth)/login/page.tsx` | Login page |
| `src/app/(auth)/register/page.tsx` | Register page |
| `src/app/(dashboard)/layout.tsx` | Sidebar + header layout |
| `src/app/(dashboard)/page.tsx` | Dashboard (agent card grid) |
| `src/app/(dashboard)/agents/[id]/page.tsx` | Agent detail page |
| `src/app/(dashboard)/settings/page.tsx` | User settings page |
| `src/app/api/auth/login/route.ts` | BFF: login → set cookies |
| `src/app/api/auth/register/route.ts` | BFF: register → set cookies |
| `src/app/api/auth/logout/route.ts` | BFF: clear cookies |
| `src/app/api/auth/oauth/[provider]/route.ts` | BFF: redirect to ClawHost OAuth |
| `src/app/auth/callback/route.ts` | OAuth callback: set cookies → redirect |
| `src/app/api/agents/[id]/status/route.ts` | SWR proxy: agent status polling |
| `src/app/api/agents/[id]/channels/route.ts` | SWR proxy: channel list |
| `src/app/api/agents/[id]/channels/wechat/login/route.ts` | SWR proxy: start WeChat QR login |
| `src/app/api/agents/[id]/channels/wechat/login/status/route.ts` | SWR proxy: poll WeChat login status |
| `src/components/sidebar.tsx` | Sidebar navigation with locale switcher |
| `src/components/agent-card.tsx` | Agent card for dashboard grid |
| `src/components/agent-status-badge.tsx` | Status badge component |
| `src/components/create-agent-dialog.tsx` | Dialog with name input for creating agent |
| `src/components/channel-list.tsx` | Connected channels list + add channel |
| `src/components/wechat-qr-dialog.tsx` | WeChat QR code login dialog |
| `src/components/telegram-dialog.tsx` | Telegram bot token input dialog |
| `src/components/confirm-dialog.tsx` | Reusable confirmation dialog |
| `src/components/locale-switcher.tsx` | Language toggle button |
| `src/hooks/use-agent-status.ts` | SWR hook for polling agent status |
| `Dockerfile` | Multi-stage Docker build for portal |

### Config files (in `portal/`)

| File | Notes |
|------|-------|
| `package.json` | Created by create-next-app, deps added manually |
| `next.config.ts` | next-intl plugin wrapper, standalone output |
| `tailwind.config.ts` | Created by create-next-app |
| `tsconfig.json` | Created by create-next-app |
| `components.json` | Created by shadcn init |

### Modified files (in repo root)

| File | Change |
|------|--------|
| `.gitignore` | Add `portal/node_modules/`, `portal/.next/` |

---

## Task 1: Scaffold Next.js project and install dependencies

**Files:**
- Create: `portal/` (via create-next-app)
- Modify: `.gitignore`

- [ ] **Step 1: Create Next.js project**

```bash
cd /Users/rain/code/west-garden/clawhost
pnpm create next-app@latest portal --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --turbopack
```

When prompted, select defaults. This creates the Next.js project with App Router, TypeScript, Tailwind, and `src/` directory.

- [ ] **Step 2: Install additional dependencies**

```bash
cd /Users/rain/code/west-garden/clawhost/portal
pnpm add next-intl swr sonner
pnpm add -D @types/node
```

- [ ] **Step 3: Initialize shadcn/ui**

```bash
cd /Users/rain/code/west-garden/clawhost/portal
pnpm dlx shadcn@latest init -d
```

This creates `components.json` and `src/lib/utils.ts` (with the `cn()` helper). Accept defaults (New York style, Zinc color, CSS variables).

- [ ] **Step 4: Install required shadcn/ui components**

```bash
cd /Users/rain/code/west-garden/clawhost/portal
pnpm dlx shadcn@latest add button input label card dialog tabs badge separator skeleton avatar dropdown-menu sheet sonner
```

- [ ] **Step 5: Update next.config.ts for next-intl and standalone output**

Replace `portal/next.config.ts` with:

```typescript
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
};

export default withNextIntl(nextConfig);
```

- [ ] **Step 6: Update .gitignore in repo root**

Append to the root `.gitignore`:

```
# Portal frontend
portal/node_modules/
portal/.next/
```

- [ ] **Step 7: Verify build**

```bash
cd /Users/rain/code/west-garden/clawhost/portal
pnpm build
```

Expected: Build succeeds (may have warnings about unused default pages, that's fine).

- [ ] **Step 8: Commit**

```bash
cd /Users/rain/code/west-garden/clawhost
git add portal/ .gitignore
git commit -m "feat(portal): scaffold Next.js project with dependencies"
```

---

## Task 2: TypeScript types and utility functions

**Files:**
- Create: `portal/src/types/index.ts`

- [ ] **Step 1: Create TypeScript types matching ClawHost API**

```typescript
// portal/src/types/index.ts

// --- User ---

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  oauth_provider?: string;
  oauth_id?: string;
  role: "user" | "admin";
  status: "active" | "disabled";
  api_token?: string;
  created_at: string;
  updated_at: string;
}

// --- Agent ---

export type AgentStatus = "created" | "running" | "stopped" | "error";

export interface Agent {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  access_token: string;
  status: AgentStatus;
  config: Record<string, unknown> | null;
  endpoint: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DeploymentStatusInfo {
  status: "ready" | "updating" | "starting" | "not_ready" | "not_found";
  ready_replicas: number;
  desired_replicas: number;
  updated_replicas: number;
}

export interface AgentDetail extends Agent {
  deployment_status?: DeploymentStatusInfo;
  image?: string;
  latest_image?: string;
  image_up_to_date?: boolean;
}

export interface AgentCreateResponse extends Agent {
  access_url: string;
}

export interface AgentStatusResponse {
  id: string;
  name: string;
  status: AgentStatus;
  ready: boolean;
  endpoint?: string;
}

export interface AgentConnectResponse {
  id: string;
  name: string;
  status: AgentStatus;
  ready: boolean;
  token?: string;
  endpoint?: string;
  ws_url?: string;
  webchat_url?: string;
}

// --- Channels ---

export interface ChannelConfig {
  [key: string]: unknown;
}

export interface WechatAccount {
  account_id: string;
  name: string;
  base_url: string;
  user_id: string;
  saved_at: string;
  configured: boolean;
}

export interface WechatLoginStatusResponse {
  status: "wait" | "scaned" | "expired" | "confirmed";
  connected: boolean;
  message: string;
  account_id?: string;
}

// --- API Response Wrapper ---

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
}

// --- Auth ---

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  user: User;
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/rain/code/west-garden/clawhost/portal
pnpm build
```

- [ ] **Step 3: Commit**

```bash
cd /Users/rain/code/west-garden/clawhost
git add portal/src/types/
git commit -m "feat(portal): add TypeScript types for ClawHost API"
```

---

## Task 3: Server-side API client and auth helpers

**Files:**
- Create: `portal/src/lib/api.ts`
- Create: `portal/src/lib/auth.ts`

- [ ] **Step 1: Create auth helpers**

```typescript
// portal/src/lib/auth.ts
import { cookies } from "next/headers";

const TOKEN_COOKIE = "token";
const REFRESH_COOKIE = "refresh";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function getAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(TOKEN_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(REFRESH_COOKIE)?.value;
}

export async function setAuthCookies(
  accessToken: string,
  refreshToken: string
) {
  const cookieStore = await cookies();
  cookieStore.set(TOKEN_COOKIE, accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: 60 * 60 * 24 * 7, // 7 days (refresh token lifetime)
  });
  cookieStore.set(REFRESH_COOKIE, refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(TOKEN_COOKIE);
  cookieStore.delete(REFRESH_COOKIE);
}

/**
 * Decode JWT payload without verification (just base64 decode).
 * Used in middleware to check expiry.
 */
export function decodeJwtPayload(
  token: string
): { exp?: number; user_id?: string; email?: string; role?: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    );
    return payload;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Create server-side API client**

```typescript
// portal/src/lib/api.ts
import { getAccessToken } from "./auth";
import type { ApiResponse } from "@/types";

const API_URL =
  process.env.CLAWHOST_API_URL || "http://localhost:18080";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Server-side fetch to ClawHost API. Reads JWT from cookies automatically.
 * Unwraps { code, message, data } response format.
 */
async function fetchApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as ApiResponse;
    throw new ApiError(res.status, body.message || `API error ${res.status}`);
  }

  const body = (await res.json()) as ApiResponse<T>;
  return body.data as T;
}

/**
 * Fetch without token (for auth endpoints called from API routes).
 * Takes raw token string instead of reading from cookies.
 */
export async function fetchApiWithToken<T>(
  path: string,
  token: string | undefined,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  return (await res.json()) as ApiResponse<T>;
}

/**
 * Raw fetch to ClawHost (no token, no unwrapping). Used by auth API routes.
 */
export async function fetchApiRaw(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  return fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });
}

// --- Auth API ---

export { fetchApi };

// --- Agent API ---

export async function listAgents() {
  return fetchApi<import("@/types").Agent[]>("/api/v1/agents");
}

export async function getAgent(id: string) {
  return fetchApi<import("@/types").AgentDetail>(`/api/v1/agents/${id}`);
}

export async function getAgentConnect(id: string) {
  return fetchApi<import("@/types").AgentConnectResponse>(
    `/api/v1/agents/${id}/connect`
  );
}

export async function getProfile() {
  return fetchApi<import("@/types").User>("/auth/me");
}
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/rain/code/west-garden/clawhost/portal
pnpm build
```

- [ ] **Step 4: Commit**

```bash
cd /Users/rain/code/west-garden/clawhost
git add portal/src/lib/api.ts portal/src/lib/auth.ts
git commit -m "feat(portal): add server-side API client and auth helpers"
```

---

## Task 4: i18n setup

**Files:**
- Create: `portal/src/i18n/config.ts`
- Create: `portal/src/i18n/request.ts`
- Create: `portal/src/messages/zh.json`
- Create: `portal/src/messages/en.json`

- [ ] **Step 1: Create i18n config**

```typescript
// portal/src/i18n/config.ts
export const locales = ["zh", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "zh";
```

- [ ] **Step 2: Create next-intl request config**

```typescript
// portal/src/i18n/request.ts
import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, type Locale, locales } from "./config";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("locale")?.value as Locale | undefined;
  const locale =
    cookieLocale && locales.includes(cookieLocale)
      ? cookieLocale
      : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 3: Create Chinese translation file**

```json
{
  "common": {
    "loading": "加载中...",
    "save": "保存",
    "cancel": "取消",
    "confirm": "确认",
    "delete": "删除",
    "copy": "复制",
    "copied": "已复制",
    "open": "打开",
    "close": "关闭",
    "back": "返回",
    "error": "出错了",
    "retry": "重试",
    "noPermission": "没有权限",
    "notFound": "页面不存在"
  },
  "auth": {
    "login": "登录",
    "register": "注册",
    "logout": "退出登录",
    "email": "邮箱",
    "password": "密码",
    "name": "姓名",
    "emailPlaceholder": "请输入邮箱",
    "passwordPlaceholder": "请输入密码",
    "namePlaceholder": "请输入姓名",
    "loginWithGithub": "使用 GitHub 登录",
    "loginWithGoogle": "使用 Google 登录",
    "noAccount": "还没有账号？",
    "hasAccount": "已有账号？",
    "goRegister": "去注册",
    "goLogin": "去登录",
    "loginFailed": "登录失败",
    "registerFailed": "注册失败",
    "passwordMin": "密码至少 8 个字符"
  },
  "sidebar": {
    "agents": "我的 Agent",
    "settings": "设置"
  },
  "dashboard": {
    "title": "我的 Agent",
    "createAgent": "新建 Agent",
    "emptyTitle": "创建你的第一个 AI Agent",
    "emptyDescription": "点击下方按钮开始",
    "agentName": "Agent 名称",
    "agentNamePlaceholder": "给你的 Agent 起个名字",
    "creating": "创建中..."
  },
  "agent": {
    "overview": "概览",
    "channels": "渠道",
    "status": {
      "created": "已创建",
      "running": "运行中",
      "stopped": "已停止",
      "error": "异常"
    },
    "actions": {
      "start": "启动",
      "stop": "停止",
      "restart": "重启",
      "starting": "启动中...",
      "stopping": "停止中...",
      "restarting": "重启中..."
    },
    "connect": {
      "webui": "WebUI",
      "apiEndpoint": "API Endpoint",
      "accessToken": "Access Token",
      "resetToken": "重置 Token",
      "resetTokenConfirm": "重置后旧 Token 将立即失效，确定要重置吗？",
      "tokenReset": "Token 已重置"
    },
    "info": {
      "createdAt": "创建时间",
      "slug": "Slug"
    },
    "danger": {
      "title": "危险操作",
      "deleteAgent": "删除 Agent",
      "deleteConfirm": "此操作不可撤销。请输入 Agent 名称 \"{name}\" 确认删除。",
      "deleteConfirmPlaceholder": "输入 Agent 名称",
      "deleted": "Agent 已删除"
    },
    "notRunning": "Agent 未运行，请先启动",
    "startSuccess": "Agent 已启动",
    "stopSuccess": "Agent 已停止",
    "restartSuccess": "Agent 已重启"
  },
  "channels": {
    "title": "已连接渠道",
    "empty": "暂无连接的渠道",
    "add": "添加渠道",
    "remove": "移除",
    "removeConfirm": "确定要移除此渠道吗？",
    "removed": "渠道已移除",
    "wechat": {
      "name": "微信",
      "scanQr": "扫码登录",
      "scanning": "请用微信扫描二维码",
      "waitingScan": "等待扫码...",
      "scanned": "已扫码，请在手机上确认",
      "expired": "二维码已过期，请重试",
      "success": "微信登录成功",
      "loginFailed": "微信登录失败"
    },
    "telegram": {
      "name": "Telegram",
      "botToken": "Bot Token",
      "botTokenPlaceholder": "输入 Telegram Bot Token",
      "added": "Telegram 渠道已添加"
    }
  },
  "settings": {
    "title": "设置",
    "profile": "个人资料",
    "changePassword": "修改密码",
    "oldPassword": "当前密码",
    "newPassword": "新密码",
    "passwordChanged": "密码已修改",
    "profileUpdated": "资料已更新"
  }
}
```

- [ ] **Step 4: Create English translation file**

```json
{
  "common": {
    "loading": "Loading...",
    "save": "Save",
    "cancel": "Cancel",
    "confirm": "Confirm",
    "delete": "Delete",
    "copy": "Copy",
    "copied": "Copied",
    "open": "Open",
    "close": "Close",
    "back": "Back",
    "error": "Something went wrong",
    "retry": "Retry",
    "noPermission": "No permission",
    "notFound": "Page not found"
  },
  "auth": {
    "login": "Login",
    "register": "Register",
    "logout": "Logout",
    "email": "Email",
    "password": "Password",
    "name": "Name",
    "emailPlaceholder": "Enter your email",
    "passwordPlaceholder": "Enter your password",
    "namePlaceholder": "Enter your name",
    "loginWithGithub": "Login with GitHub",
    "loginWithGoogle": "Login with Google",
    "noAccount": "Don't have an account?",
    "hasAccount": "Already have an account?",
    "goRegister": "Register",
    "goLogin": "Login",
    "loginFailed": "Login failed",
    "registerFailed": "Registration failed",
    "passwordMin": "Password must be at least 8 characters"
  },
  "sidebar": {
    "agents": "My Agents",
    "settings": "Settings"
  },
  "dashboard": {
    "title": "My Agents",
    "createAgent": "New Agent",
    "emptyTitle": "Create your first AI Agent",
    "emptyDescription": "Click the button below to get started",
    "agentName": "Agent Name",
    "agentNamePlaceholder": "Give your agent a name",
    "creating": "Creating..."
  },
  "agent": {
    "overview": "Overview",
    "channels": "Channels",
    "status": {
      "created": "Created",
      "running": "Running",
      "stopped": "Stopped",
      "error": "Error"
    },
    "actions": {
      "start": "Start",
      "stop": "Stop",
      "restart": "Restart",
      "starting": "Starting...",
      "stopping": "Stopping...",
      "restarting": "Restarting..."
    },
    "connect": {
      "webui": "WebUI",
      "apiEndpoint": "API Endpoint",
      "accessToken": "Access Token",
      "resetToken": "Reset Token",
      "resetTokenConfirm": "The old token will be invalidated immediately. Are you sure?",
      "tokenReset": "Token has been reset"
    },
    "info": {
      "createdAt": "Created",
      "slug": "Slug"
    },
    "danger": {
      "title": "Danger Zone",
      "deleteAgent": "Delete Agent",
      "deleteConfirm": "This action cannot be undone. Type the agent name \"{name}\" to confirm.",
      "deleteConfirmPlaceholder": "Type agent name",
      "deleted": "Agent deleted"
    },
    "notRunning": "Agent is not running. Start it first.",
    "startSuccess": "Agent started",
    "stopSuccess": "Agent stopped",
    "restartSuccess": "Agent restarted"
  },
  "channels": {
    "title": "Connected Channels",
    "empty": "No channels connected",
    "add": "Add Channel",
    "remove": "Remove",
    "removeConfirm": "Are you sure you want to remove this channel?",
    "removed": "Channel removed",
    "wechat": {
      "name": "WeChat",
      "scanQr": "Scan QR Code",
      "scanning": "Scan the QR code with WeChat",
      "waitingScan": "Waiting for scan...",
      "scanned": "Scanned, please confirm on your phone",
      "expired": "QR code expired, please retry",
      "success": "WeChat login successful",
      "loginFailed": "WeChat login failed"
    },
    "telegram": {
      "name": "Telegram",
      "botToken": "Bot Token",
      "botTokenPlaceholder": "Enter Telegram Bot Token",
      "added": "Telegram channel added"
    }
  },
  "settings": {
    "title": "Settings",
    "profile": "Profile",
    "changePassword": "Change Password",
    "oldPassword": "Current Password",
    "newPassword": "New Password",
    "passwordChanged": "Password changed",
    "profileUpdated": "Profile updated"
  }
}
```

- [ ] **Step 5: Verify build**

```bash
cd /Users/rain/code/west-garden/clawhost/portal
pnpm build
```

- [ ] **Step 6: Commit**

```bash
cd /Users/rain/code/west-garden/clawhost
git add portal/src/i18n/ portal/src/messages/
git commit -m "feat(portal): add i18n setup with Chinese and English"
```

---

## Task 5: Root layout, not-found page, and auth API routes

**Files:**
- Modify: `portal/src/app/layout.tsx`
- Create: `portal/src/app/not-found.tsx`
- Create: `portal/src/app/api/auth/login/route.ts`
- Create: `portal/src/app/api/auth/register/route.ts`
- Create: `portal/src/app/api/auth/logout/route.ts`
- Create: `portal/src/app/api/auth/oauth/[provider]/route.ts`
- Create: `portal/src/app/auth/callback/route.ts`

- [ ] **Step 1: Update root layout**

Replace `portal/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ClawHost",
  description: "Manage your AI agents",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>
          {children}
          <Toaster position="top-right" richColors />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Create not-found page**

```tsx
// portal/src/app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">Page not found</p>
        <Link href="/" className="mt-4 inline-block text-primary underline">
          Go home
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create login API route**

```typescript
// portal/src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fetchApiRaw } from "@/lib/api";
import type { ApiResponse, AuthTokens } from "@/types";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const res = await fetchApiRaw("/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as ApiResponse<AuthTokens>;

  if (!res.ok || data.code !== 0 || !data.data) {
    return NextResponse.json(
      { message: data.message || "Login failed" },
      { status: res.status }
    );
  }

  const { access_token, refresh_token, user } = data.data;

  const response = NextResponse.json({ user });

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };

  response.cookies.set("token", access_token, cookieOptions);
  response.cookies.set("refresh", refresh_token, cookieOptions);

  return response;
}
```

- [ ] **Step 4: Create register API route**

```typescript
// portal/src/app/api/auth/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fetchApiRaw } from "@/lib/api";
import type { ApiResponse, AuthTokens } from "@/types";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const res = await fetchApiRaw("/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as ApiResponse<AuthTokens>;

  if (!res.ok || data.code !== 0 || !data.data) {
    return NextResponse.json(
      { message: data.message || "Registration failed" },
      { status: res.status }
    );
  }

  const { access_token, refresh_token, user } = data.data;

  const response = NextResponse.json({ user });

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };

  response.cookies.set("token", access_token, cookieOptions);
  response.cookies.set("refresh", refresh_token, cookieOptions);

  return response;
}
```

- [ ] **Step 5: Create logout API route**

```typescript
// portal/src/app/api/auth/logout/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ message: "logged out" });
  response.cookies.delete("token");
  response.cookies.delete("refresh");
  return response;
}
```

- [ ] **Step 6: Create OAuth redirect API route**

```typescript
// portal/src/app/api/auth/oauth/[provider]/route.ts
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.CLAWHOST_API_URL || "http://localhost:18080";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  return NextResponse.redirect(`${API_URL}/auth/oauth/${provider}`);
}
```

- [ ] **Step 7: Create OAuth callback handler**

```typescript
// portal/src/app/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const accessToken = searchParams.get("access_token");
  const refreshToken = searchParams.get("refresh_token");

  if (!accessToken || !refreshToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const response = NextResponse.redirect(new URL("/", request.url));

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };

  response.cookies.set("token", accessToken, cookieOptions);
  response.cookies.set("refresh", refreshToken, cookieOptions);

  return response;
}
```

- [ ] **Step 8: Verify build**

```bash
cd /Users/rain/code/west-garden/clawhost/portal
pnpm build
```

- [ ] **Step 9: Commit**

```bash
cd /Users/rain/code/west-garden/clawhost
git add portal/src/app/layout.tsx portal/src/app/not-found.tsx portal/src/app/api/auth/ portal/src/app/auth/
git commit -m "feat(portal): add root layout, auth API routes, OAuth callback"
```

---

## Task 6: Next.js middleware (auth guard + token refresh)

**Files:**
- Create: `portal/src/middleware.ts`

- [ ] **Step 1: Create middleware**

```typescript
// portal/src/middleware.ts
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/auth/callback"];
const API_URL = process.env.CLAWHOST_API_URL || "http://localhost:18080";

function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.exp ?? null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip public paths and API routes
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("token")?.value;
  const refresh = request.cookies.get("refresh")?.value;

  // No token at all → redirect to login
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Check expiry
  const exp = decodeJwtExp(token);
  const now = Math.floor(Date.now() / 1000);

  if (exp && exp - now < 60) {
    // Token expired or near-expiry → try refresh
    if (!refresh) {
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("token");
      response.cookies.delete("refresh");
      return response;
    }

    try {
      const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });

      if (!refreshRes.ok) {
        const response = NextResponse.redirect(new URL("/login", request.url));
        response.cookies.delete("token");
        response.cookies.delete("refresh");
        return response;
      }

      const data = await refreshRes.json();
      if (data.code !== 0 || !data.data) {
        const response = NextResponse.redirect(new URL("/login", request.url));
        response.cookies.delete("token");
        response.cookies.delete("refresh");
        return response;
      }

      const response = NextResponse.next();
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      };
      response.cookies.set("token", data.data.access_token, cookieOptions);
      response.cookies.set("refresh", data.data.refresh_token, cookieOptions);
      return response;
    } catch {
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("token");
      response.cookies.delete("refresh");
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/rain/code/west-garden/clawhost/portal
pnpm build
```

- [ ] **Step 3: Commit**

```bash
cd /Users/rain/code/west-garden/clawhost
git add portal/src/middleware.ts
git commit -m "feat(portal): add auth middleware with token refresh"
```

---

## Task 7: Auth layout, login page, and register page

**Files:**
- Create: `portal/src/app/(auth)/layout.tsx`
- Create: `portal/src/app/(auth)/login/page.tsx`
- Create: `portal/src/app/(auth)/register/page.tsx`

- [ ] **Step 1: Create auth layout**

```tsx
// portal/src/app/(auth)/layout.tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Create login page**

```tsx
// portal/src/app/(auth)/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.message || t("auth.loginFailed"));
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      toast.error(t("auth.loginFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">ClawHost</CardTitle>
        <CardDescription>{t("auth.login")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder={t("auth.emailPlaceholder")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder={t("auth.passwordPlaceholder")}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("common.loading") : t("auth.login")}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-2">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">OR</span>
          <Separator className="flex-1" />
        </div>

        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => (window.location.href = "/api/auth/oauth/github")}
          >
            {t("auth.loginWithGithub")}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => (window.location.href = "/api/auth/oauth/google")}
          >
            {t("auth.loginWithGoogle")}
          </Button>
        </div>
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <span className="text-muted-foreground">{t("auth.noAccount")}</span>
        <Link href="/register" className="ml-1 text-primary underline">
          {t("auth.goRegister")}
        </Link>
      </CardFooter>
    </Card>
  );
}
```

- [ ] **Step 3: Create register page**

```tsx
// portal/src/app/(auth)/register/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export default function RegisterPage() {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (password.length < 8) {
      toast.error(t("auth.passwordMin"));
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.message || t("auth.registerFailed"));
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      toast.error(t("auth.registerFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">ClawHost</CardTitle>
        <CardDescription>{t("auth.register")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("auth.name")}</Label>
            <Input
              id="name"
              name="name"
              placeholder={t("auth.namePlaceholder")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder={t("auth.emailPlaceholder")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder={t("auth.passwordPlaceholder")}
              minLength={8}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("common.loading") : t("auth.register")}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <span className="text-muted-foreground">{t("auth.hasAccount")}</span>
        <Link href="/login" className="ml-1 text-primary underline">
          {t("auth.goLogin")}
        </Link>
      </CardFooter>
    </Card>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
cd /Users/rain/code/west-garden/clawhost/portal
pnpm build
```

- [ ] **Step 5: Commit**

```bash
cd /Users/rain/code/west-garden/clawhost
git add portal/src/app/\(auth\)/
git commit -m "feat(portal): add auth layout, login and register pages"
```

---

## Task 8: Dashboard layout with sidebar

**Files:**
- Create: `portal/src/components/sidebar.tsx`
- Create: `portal/src/components/locale-switcher.tsx`
- Create: `portal/src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create locale switcher**

```tsx
// portal/src/components/locale-switcher.tsx
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LocaleSwitcher({ locale }: { locale: string }) {
  const router = useRouter();

  function toggleLocale() {
    const next = locale === "zh" ? "en" : "zh";
    document.cookie = `locale=${next};path=/;max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggleLocale}>
      {locale === "zh" ? "EN" : "中文"}
    </Button>
  );
}
```

- [ ] **Step 2: Create sidebar**

```tsx
// portal/src/components/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "./locale-switcher";
import type { User } from "@/types";

interface SidebarProps {
  user: User;
  locale: string;
}

const navItems = [
  { key: "agents" as const, href: "/" },
  { key: "settings" as const, href: "/settings" },
];

export function Sidebar({ user, locale }: SidebarProps) {
  const t = useTranslations("sidebar");
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-full w-60 flex-col border-r bg-white">
      {/* Logo */}
      <div className="flex h-14 items-center px-4 font-semibold text-lg">
        ClawHost
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-2">
        {navItems.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === item.href
                ? "bg-gray-100 text-gray-900"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            {t(item.key)}
          </Link>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="border-t p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground truncate">
            {user.name || user.email}
          </span>
          <LocaleSwitcher locale={locale} />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={handleLogout}
        >
          {t("logout") || "退出登录"}
        </Button>
      </div>
    </aside>
  );
}
```

Note: Add `"logout"` key to both translation files in `sidebar` namespace. Append to `portal/src/messages/zh.json` sidebar section: `"logout": "退出登录"`. Append to `portal/src/messages/en.json` sidebar section: `"logout": "Logout"`.

- [ ] **Step 3: Create dashboard layout**

```tsx
// portal/src/app/(dashboard)/layout.tsx
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getProfile } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { ApiError } from "@/lib/api";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  try {
    user = await getProfile();
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      redirect("/login");
    }
    throw e;
  }

  const locale = await getLocale();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar user={user} locale={locale} />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl p-6">{children}</div>
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Update translation files with sidebar.logout key**

Add `"logout": "退出登录"` to `sidebar` section of `portal/src/messages/zh.json`.
Add `"logout": "Logout"` to `sidebar` section of `portal/src/messages/en.json`.

- [ ] **Step 5: Verify build**

```bash
cd /Users/rain/code/west-garden/clawhost/portal
pnpm build
```

- [ ] **Step 6: Commit**

```bash
cd /Users/rain/code/west-garden/clawhost
git add portal/src/components/sidebar.tsx portal/src/components/locale-switcher.tsx portal/src/app/\(dashboard\)/layout.tsx portal/src/messages/
git commit -m "feat(portal): add dashboard layout with sidebar"
```

---

## Task 9: Dashboard page with agent cards and create dialog

**Files:**
- Create: `portal/src/components/agent-status-badge.tsx`
- Create: `portal/src/components/agent-card.tsx`
- Create: `portal/src/components/create-agent-dialog.tsx`
- Create: `portal/src/lib/actions.ts`
- Create: `portal/src/app/(dashboard)/page.tsx`
- Create: `portal/src/app/(dashboard)/loading.tsx`

- [ ] **Step 1: Create agent status badge**

```tsx
// portal/src/components/agent-status-badge.tsx
"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AgentStatus } from "@/types";

const statusConfig: Record<AgentStatus, { color: string; dot: string }> = {
  created: { color: "bg-gray-100 text-gray-700", dot: "bg-gray-400" },
  running: { color: "bg-green-100 text-green-700", dot: "bg-green-500" },
  stopped: { color: "bg-gray-100 text-gray-700", dot: "bg-gray-400" },
  error: { color: "bg-red-100 text-red-700", dot: "bg-red-500" },
};

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const t = useTranslations("agent.status");
  const config = statusConfig[status] || statusConfig.created;

  return (
    <Badge variant="secondary" className={cn("gap-1.5", config.color)}>
      <span className={cn("h-2 w-2 rounded-full", config.dot)} />
      {t(status)}
    </Badge>
  );
}
```

- [ ] **Step 2: Create agent card**

```tsx
// portal/src/components/agent-card.tsx
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { AgentStatusBadge } from "./agent-status-badge";
import type { Agent } from "@/types";

export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Link href={`/agents/${agent.id}`}>
      <Card className="cursor-pointer transition-shadow hover:shadow-md">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <h3 className="font-medium truncate">{agent.name}</h3>
            <AgentStatusBadge status={agent.status} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {agent.slug}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 3: Create server actions**

```typescript
// portal/src/lib/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccessToken } from "./auth";
import type { ApiResponse, AgentCreateResponse } from "@/types";

const API_URL = process.env.CLAWHOST_API_URL || "http://localhost:18080";

async function fetchWithAuth(path: string, options: RequestInit = {}) {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(`${API_URL}${path}`, { ...options, headers, cache: "no-store" });
}

export async function createAgent(name: string) {
  const res = await fetchWithAuth("/api/v1/agents", {
    method: "POST",
    body: JSON.stringify({ name }),
  });

  const data = (await res.json()) as ApiResponse<AgentCreateResponse>;
  if (!res.ok || data.code !== 0 || !data.data) {
    return { error: data.message || "Failed to create agent" };
  }

  redirect(`/agents/${data.data.id}`);
}

export async function startAgent(id: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${id}/start`, {
    method: "POST",
  });
  const data = (await res.json()) as ApiResponse;
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to start agent" };
  }
  revalidatePath(`/agents/${id}`);
  return { success: true };
}

export async function stopAgent(id: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${id}/stop`, {
    method: "POST",
  });
  const data = (await res.json()) as ApiResponse;
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to stop agent" };
  }
  revalidatePath(`/agents/${id}`);
  return { success: true };
}

export async function restartAgent(id: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${id}/restart`, {
    method: "POST",
  });
  const data = (await res.json()) as ApiResponse;
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to restart agent" };
  }
  revalidatePath(`/agents/${id}`);
  return { success: true };
}

export async function deleteAgent(id: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${id}`, {
    method: "DELETE",
  });
  const data = (await res.json()) as ApiResponse;
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to delete agent" };
  }
  redirect("/");
}

export async function resetAgentToken(id: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${id}/reset-token`, {
    method: "POST",
  });
  const data = (await res.json()) as ApiResponse;
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to reset token" };
  }
  revalidatePath(`/agents/${id}`);
  return { success: true };
}

export async function addChannel(
  agentId: string,
  channel: string,
  config: Record<string, string>
) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/channels`, {
    method: "POST",
    body: JSON.stringify({ channel, ...config }),
  });
  const data = (await res.json()) as ApiResponse;
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to add channel" };
  }
  return { success: true };
}

export async function removeChannel(agentId: string, channel: string) {
  const res = await fetchWithAuth(
    `/api/v1/agents/${agentId}/channels/${channel}`,
    { method: "DELETE" }
  );
  const data = (await res.json()) as ApiResponse;
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to remove channel" };
  }
  return { success: true };
}

export async function updateProfile(name: string) {
  const res = await fetchWithAuth("/auth/me", {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
  const data = (await res.json()) as ApiResponse;
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to update profile" };
  }
  revalidatePath("/settings");
  return { success: true };
}

export async function changePassword(oldPassword: string, newPassword: string) {
  const res = await fetchWithAuth("/auth/me/password", {
    method: "PUT",
    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
  });
  const data = (await res.json()) as ApiResponse;
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to change password" };
  }
  return { success: true };
}
```

- [ ] **Step 4: Create create-agent dialog**

```tsx
// portal/src/components/create-agent-dialog.tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createAgent } from "@/lib/actions";

export function CreateAgentDialog({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;

    try {
      const result = await createAgent(name);
      if (result?.error) {
        toast.error(result.error);
        setLoading(false);
      }
      // On success, createAgent calls redirect() so we won't reach here
    } catch {
      // redirect() throws a NEXT_REDIRECT error which is expected
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("dashboard.createAgent")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agent-name">{t("dashboard.agentName")}</Label>
            <Input
              id="agent-name"
              name="name"
              placeholder={t("dashboard.agentNamePlaceholder")}
              required
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t("dashboard.creating") : t("dashboard.createAgent")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Create dashboard page**

```tsx
// portal/src/app/(dashboard)/page.tsx
import { getTranslations } from "next-intl/server";
import { listAgents } from "@/lib/api";
import { AgentCard } from "@/components/agent-card";
import { CreateAgentDialog } from "@/components/create-agent-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const agents = await listAgents();

  // Empty state
  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h2 className="text-xl font-semibold">{t("emptyTitle")}</h2>
        <p className="mt-2 text-muted-foreground">{t("emptyDescription")}</p>
        <CreateAgentDialog>
          <Button className="mt-6" size="lg">
            {t("createAgent")}
          </Button>
        </CreateAgentDialog>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">{t("title")}</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}

        {/* Create new agent card */}
        <CreateAgentDialog>
          <Card className="cursor-pointer border-dashed transition-shadow hover:shadow-md">
            <CardContent className="flex items-center justify-center p-8">
              <div className="text-center text-muted-foreground">
                <div className="text-3xl mb-1">+</div>
                <div className="text-sm">{t("createAgent")}</div>
              </div>
            </CardContent>
          </Card>
        </CreateAgentDialog>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create dashboard loading skeleton**

```tsx
// portal/src/app/(dashboard)/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div>
      <Skeleton className="h-8 w-40 mb-6" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Verify build**

```bash
cd /Users/rain/code/west-garden/clawhost/portal
pnpm build
```

- [ ] **Step 8: Commit**

```bash
cd /Users/rain/code/west-garden/clawhost
git add portal/src/components/agent-status-badge.tsx portal/src/components/agent-card.tsx portal/src/components/create-agent-dialog.tsx portal/src/lib/actions.ts portal/src/app/\(dashboard\)/page.tsx portal/src/app/\(dashboard\)/loading.tsx
git commit -m "feat(portal): add dashboard page with agent cards and create dialog"
```

---

## Task 10: Agent status polling API route and SWR hook

**Files:**
- Create: `portal/src/app/api/agents/[id]/status/route.ts`
- Create: `portal/src/app/api/agents/[id]/channels/route.ts`
- Create: `portal/src/hooks/use-agent-status.ts`

- [ ] **Step 1: Create agent status proxy route**

```typescript
// portal/src/app/api/agents/[id]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fetchApiWithToken } from "@/lib/api";
import type { AgentStatusResponse } from "@/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = request.cookies.get("token")?.value;

  const data = await fetchApiWithToken<AgentStatusResponse>(
    `/api/v1/agents/${id}/status`,
    token
  );

  return NextResponse.json(data);
}
```

- [ ] **Step 2: Create channels proxy route**

```typescript
// portal/src/app/api/agents/[id]/channels/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fetchApiWithToken } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = request.cookies.get("token")?.value;

  const data = await fetchApiWithToken(
    `/api/v1/agents/${id}/channels`,
    token
  );

  return NextResponse.json(data);
}
```

- [ ] **Step 3: Create SWR hook for agent status**

```typescript
// portal/src/hooks/use-agent-status.ts
import useSWR from "swr";
import type { AgentStatusResponse, ApiResponse } from "@/types";

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json()) as Promise<ApiResponse<AgentStatusResponse>>;

export function useAgentStatus(agentId: string, enabled = true) {
  const { data, error, isLoading, mutate } = useSWR(
    enabled ? `/api/agents/${agentId}/status` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  return {
    status: data?.data,
    error,
    isLoading,
    mutate,
  };
}
```

- [ ] **Step 4: Verify build**

```bash
cd /Users/rain/code/west-garden/clawhost/portal
pnpm build
```

- [ ] **Step 5: Commit**

```bash
cd /Users/rain/code/west-garden/clawhost
git add portal/src/app/api/agents/ portal/src/hooks/
git commit -m "feat(portal): add agent status polling API route and SWR hook"
```

---

## Task 11: Agent detail page — Overview tab

**Files:**
- Create: `portal/src/components/confirm-dialog.tsx`
- Create: `portal/src/app/(dashboard)/agents/[id]/page.tsx`

- [ ] **Step 1: Create confirm dialog**

```tsx
// portal/src/components/confirm-dialog.tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  requireInput?: string;
  inputPlaceholder?: string;
  variant?: "default" | "destructive";
  loading?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  requireInput,
  inputPlaceholder,
  variant = "default",
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const t = useTranslations("common");
  const [inputValue, setInputValue] = useState("");

  const canConfirm = requireInput ? inputValue === requireInput : true;

  function handleConfirm() {
    if (!canConfirm) return;
    onConfirm();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setInputValue("");
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {requireInput && (
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={inputPlaceholder}
          />
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            disabled={!canConfirm || loading}
            onClick={handleConfirm}
          >
            {loading ? t("loading") : confirmText || t("confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create agent detail page**

```tsx
// portal/src/app/(dashboard)/agents/[id]/page.tsx
import { notFound } from "next/navigation";
import { getAgent, getAgentConnect, ApiError } from "@/lib/api";
import { AgentOverview } from "./overview";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let agent;
  let connectInfo = null;

  try {
    agent = await getAgent(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      notFound();
    }
    throw e;
  }

  if (agent.status === "running") {
    try {
      connectInfo = await getAgentConnect(id);
    } catch {
      // Agent may be starting, connect info not available yet
    }
  }

  return <AgentOverview agent={agent} connectInfo={connectInfo} />;
}
```

- [ ] **Step 3: Create agent overview client component**

```tsx
// portal/src/app/(dashboard)/agents/[id]/overview.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { AgentStatusBadge } from "@/components/agent-status-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useAgentStatus } from "@/hooks/use-agent-status";
import {
  startAgent,
  stopAgent,
  restartAgent,
  deleteAgent,
  resetAgentToken,
} from "@/lib/actions";
import type { AgentDetail, AgentConnectResponse } from "@/types";

export function AgentOverview({
  agent,
  connectInfo,
}: {
  agent: AgentDetail;
  connectInfo: AgentConnectResponse | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetTokenOpen, setResetTokenOpen] = useState(false);

  const { status: liveStatus } = useAgentStatus(agent.id, agent.status === "running");
  const currentStatus = liveStatus?.status ?? agent.status;

  async function handleAction(
    action: "start" | "stop" | "restart",
    fn: (id: string) => Promise<{ error?: string; success?: boolean }>
  ) {
    setActionLoading(action);
    const result = await fn(agent.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t(`agent.${action}Success`));
      router.refresh();
    }
    setActionLoading(null);
  }

  async function handleDelete() {
    setActionLoading("delete");
    try {
      const result = await deleteAgent(agent.id);
      if (result?.error) {
        toast.error(result.error);
        setActionLoading(null);
      }
    } catch {
      // redirect throws
    }
  }

  async function handleResetToken() {
    setActionLoading("resetToken");
    const result = await resetAgentToken(agent.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("agent.connect.tokenReset"));
      router.refresh();
    }
    setResetTokenOpen(false);
    setActionLoading(null);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success(t("common.copied"));
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← {t("common.back")}
        </Link>
        <h1 className="text-2xl font-semibold">{agent.name}</h1>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("agent.overview")}</TabsTrigger>
          <TabsTrigger value="channels">{t("agent.channels")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Status + Actions */}
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <AgentStatusBadge status={currentStatus} />
              <div className="flex gap-2">
                {currentStatus !== "running" && (
                  <Button
                    size="sm"
                    onClick={() => handleAction("start", startAgent)}
                    disabled={actionLoading !== null}
                  >
                    {actionLoading === "start"
                      ? t("agent.actions.starting")
                      : t("agent.actions.start")}
                  </Button>
                )}
                {currentStatus === "running" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction("restart", restartAgent)}
                      disabled={actionLoading !== null}
                    >
                      {actionLoading === "restart"
                        ? t("agent.actions.restarting")
                        : t("agent.actions.restart")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction("stop", stopAgent)}
                      disabled={actionLoading !== null}
                    >
                      {actionLoading === "stop"
                        ? t("agent.actions.stopping")
                        : t("agent.actions.stop")}
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Connection info (only when running) */}
          {connectInfo && currentStatus === "running" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("agent.connect.webui")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {connectInfo.webchat_url && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {t("agent.connect.webui")}
                      </p>
                      <p className="text-sm text-muted-foreground truncate max-w-md">
                        {connectInfo.webchat_url}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        window.open(connectInfo.webchat_url, "_blank")
                      }
                    >
                      {t("common.open")}
                    </Button>
                  </div>
                )}

                <Separator />

                {connectInfo.endpoint && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {t("agent.connect.apiEndpoint")}
                      </p>
                      <p className="text-sm text-muted-foreground truncate max-w-md">
                        {connectInfo.endpoint}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(connectInfo.endpoint!)}
                    >
                      {t("common.copy")}
                    </Button>
                  </div>
                )}

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {t("agent.connect.accessToken")}
                    </p>
                    <p className="text-sm text-muted-foreground font-mono">
                      {agent.access_token.slice(0, 8)}••••••••
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(agent.access_token)}
                    >
                      {t("common.copy")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setResetTokenOpen(true)}
                    >
                      {t("agent.connect.resetToken")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          <Card>
            <CardContent className="p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("agent.info.slug")}
                </span>
                <span className="font-mono">{agent.slug}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("agent.info.createdAt")}
                </span>
                <span>
                  {new Date(agent.created_at).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Danger zone */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-base text-red-600">
                {t("agent.danger.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                {t("agent.danger.deleteAgent")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="channels" className="mt-4">
          {/* ChannelList component added in Task 12 */}
          <div className="text-sm text-muted-foreground p-4">
            {t("agent.channels")}
          </div>
        </TabsContent>
      </Tabs>

      {/* Reset token confirmation */}
      <ConfirmDialog
        open={resetTokenOpen}
        onOpenChange={setResetTokenOpen}
        title={t("agent.connect.resetToken")}
        description={t("agent.connect.resetTokenConfirm")}
        loading={actionLoading === "resetToken"}
        onConfirm={handleResetToken}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("agent.danger.deleteAgent")}
        description={t("agent.danger.deleteConfirm", { name: agent.name })}
        requireInput={agent.name}
        inputPlaceholder={t("agent.danger.deleteConfirmPlaceholder")}
        variant="destructive"
        confirmText={t("common.delete")}
        loading={actionLoading === "delete"}
        onConfirm={handleDelete}
      />
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
cd /Users/rain/code/west-garden/clawhost/portal
pnpm build
```

- [ ] **Step 5: Commit**

```bash
cd /Users/rain/code/west-garden/clawhost
git add portal/src/components/confirm-dialog.tsx portal/src/app/\(dashboard\)/agents/
git commit -m "feat(portal): add agent detail page with overview tab"
```

---

## Task 12: Agent detail page — Channels tab

**Files:**
- Create: `portal/src/components/channel-list.tsx`
- Create: `portal/src/components/wechat-qr-dialog.tsx`
- Create: `portal/src/components/telegram-dialog.tsx`
- Create: `portal/src/app/api/agents/[id]/channels/wechat/login/route.ts`
- Create: `portal/src/app/api/agents/[id]/channels/wechat/login/status/route.ts`

- [ ] **Step 1: Create WeChat login API routes**

```typescript
// portal/src/app/api/agents/[id]/channels/wechat/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fetchApiWithToken } from "@/lib/api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = request.cookies.get("token")?.value;

  const data = await fetchApiWithToken(
    `/api/v1/agents/${id}/channels/wechat/login`,
    token,
    { method: "POST", body: JSON.stringify({}) }
  );

  return NextResponse.json(data);
}
```

```typescript
// portal/src/app/api/agents/[id]/channels/wechat/login/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fetchApiWithToken } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = request.cookies.get("token")?.value;

  const data = await fetchApiWithToken(
    `/api/v1/agents/${id}/channels/wechat/login/status`,
    token
  );

  return NextResponse.json(data);
}
```

- [ ] **Step 2: Create WeChat QR dialog**

```tsx
// portal/src/components/wechat-qr-dialog.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { WechatLoginStatusResponse } from "@/types";

interface WechatQrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  onSuccess: () => void;
}

export function WechatQrDialog({
  open,
  onOpenChange,
  agentId,
  onSuccess,
}: WechatQrDialogProps) {
  const t = useTranslations("channels.wechat");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("");

  const startLogin = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}/channels/wechat/login`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.data?.qrcode_url) {
        setQrUrl(data.data.qrcode_url);
        setStatusText(t("waitingScan"));
      }
    } catch {
      toast.error(t("loginFailed"));
    }
  }, [agentId, t]);

  useEffect(() => {
    if (!open) {
      setQrUrl(null);
      setStatusText("");
      return;
    }
    startLogin();
  }, [open, startLogin]);

  useEffect(() => {
    if (!open || !qrUrl) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/agents/${agentId}/channels/wechat/login/status`
        );
        const data = await res.json();
        const status = data.data as WechatLoginStatusResponse | undefined;

        if (!status) return;

        switch (status.status) {
          case "wait":
            setStatusText(t("waitingScan"));
            break;
          case "scaned":
            setStatusText(t("scanned"));
            break;
          case "expired":
            setStatusText(t("expired"));
            clearInterval(interval);
            break;
          case "confirmed":
            setStatusText(t("success"));
            toast.success(t("success"));
            clearInterval(interval);
            onSuccess();
            onOpenChange(false);
            break;
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [open, qrUrl, agentId, t, onSuccess, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("scanQr")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-4 py-4">
          {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrUrl} alt="WeChat QR Code" className="w-64 h-64" />
          ) : (
            <div className="w-64 h-64 bg-gray-100 rounded flex items-center justify-center">
              <span className="text-muted-foreground text-sm">
                {t("scanning")}
              </span>
            </div>
          )}
          <p className="text-sm text-muted-foreground">{statusText}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Create Telegram dialog**

```tsx
// portal/src/components/telegram-dialog.tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addChannel } from "@/lib/actions";

interface TelegramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  onSuccess: () => void;
}

export function TelegramDialog({
  open,
  onOpenChange,
  agentId,
  onSuccess,
}: TelegramDialogProps) {
  const t = useTranslations();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const botToken = formData.get("botToken") as string;

    const result = await addChannel(agentId, "telegram", { botToken });

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("channels.telegram.added"));
      onSuccess();
      onOpenChange(false);
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("channels.telegram.name")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="botToken">{t("channels.telegram.botToken")}</Label>
            <Input
              id="botToken"
              name="botToken"
              placeholder={t("channels.telegram.botTokenPlaceholder")}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t("common.loading") : t("common.confirm")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Create channel list component**

```tsx
// portal/src/components/channel-list.tsx
"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WechatQrDialog } from "./wechat-qr-dialog";
import { TelegramDialog } from "./telegram-dialog";
import { ConfirmDialog } from "./confirm-dialog";
import { removeChannel } from "@/lib/actions";
import type { AgentStatus, ApiResponse } from "@/types";

const channelNames: Record<string, string> = {
  telegram: "Telegram",
  "openclaw-weixin": "WeChat",
  wechat: "WeChat",
  discord: "Discord",
  slack: "Slack",
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function ChannelList({
  agentId,
  agentStatus,
}: {
  agentId: string;
  agentStatus: AgentStatus;
}) {
  const t = useTranslations();
  const [wechatOpen, setWechatOpen] = useState(false);
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  const isRunning = agentStatus === "running";

  const { data, mutate } = useSWR<ApiResponse<Record<string, unknown>>>(
    isRunning ? `/api/agents/${agentId}/channels` : null,
    fetcher,
    { refreshInterval: 10000 }
  );

  const channels = data?.data ? Object.keys(data.data) : [];

  const handleChannelAdded = useCallback(() => {
    mutate();
  }, [mutate]);

  async function handleRemove() {
    if (!removeTarget) return;
    setRemoveLoading(true);
    const result = await removeChannel(agentId, removeTarget);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("channels.removed"));
      mutate();
    }
    setRemoveTarget(null);
    setRemoveLoading(false);
  }

  if (!isRunning) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          {t("agent.notRunning")}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connected channels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("channels.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("channels.empty")}
            </p>
          ) : (
            <div className="space-y-3">
              {channels.map((ch) => (
                <div
                  key={ch}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm">
                      {channelNames[ch] || ch}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {ch}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => setRemoveTarget(ch)}
                  >
                    {t("channels.remove")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add channel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("channels.add")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setWechatOpen(true)}
            >
              <CardContent className="p-4 text-center">
                <p className="font-medium text-sm">
                  {t("channels.wechat.name")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("channels.wechat.scanQr")}
                </p>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setTelegramOpen(true)}
            >
              <CardContent className="p-4 text-center">
                <p className="font-medium text-sm">
                  {t("channels.telegram.name")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Bot Token
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <WechatQrDialog
        open={wechatOpen}
        onOpenChange={setWechatOpen}
        agentId={agentId}
        onSuccess={handleChannelAdded}
      />
      <TelegramDialog
        open={telegramOpen}
        onOpenChange={setTelegramOpen}
        agentId={agentId}
        onSuccess={handleChannelAdded}
      />
      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(v) => !v && setRemoveTarget(null)}
        title={t("channels.remove")}
        description={t("channels.removeConfirm")}
        variant="destructive"
        loading={removeLoading}
        onConfirm={handleRemove}
      />
    </div>
  );
}
```

- [ ] **Step 5: Update overview.tsx to use ChannelList**

In `portal/src/app/(dashboard)/agents/[id]/overview.tsx`:

1. Add import at the top: `import { ChannelList } from "@/components/channel-list";`
2. Replace the placeholder in the channels TabsContent:

```tsx
        <TabsContent value="channels" className="mt-4">
          <ChannelList agentId={agent.id} agentStatus={currentStatus} />
        </TabsContent>
```

- [ ] **Step 6: Verify build**

```bash
cd /Users/rain/code/west-garden/clawhost/portal
pnpm build
```

- [ ] **Step 7: Commit**

```bash
cd /Users/rain/code/west-garden/clawhost
git add portal/src/components/channel-list.tsx portal/src/components/wechat-qr-dialog.tsx portal/src/components/telegram-dialog.tsx portal/src/app/api/agents/ portal/src/app/\(dashboard\)/agents/
git commit -m "feat(portal): add channels tab with WeChat QR and Telegram support"
```

---

## Task 13: Settings page

**Files:**
- Create: `portal/src/app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Create settings page**

```tsx
// portal/src/app/(dashboard)/settings/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { updateProfile, changePassword } from "@/lib/actions";

export default function SettingsPage() {
  const t = useTranslations();
  const router = useRouter();
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  async function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProfileLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;

    const result = await updateProfile(name);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("settings.profileUpdated"));
      router.refresh();
    }
    setProfileLoading(false);
  }

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordLoading(true);

    const formData = new FormData(e.currentTarget);
    const oldPassword = formData.get("oldPassword") as string;
    const newPassword = formData.get("newPassword") as string;

    if (newPassword.length < 8) {
      toast.error(t("auth.passwordMin"));
      setPasswordLoading(false);
      return;
    }

    const result = await changePassword(oldPassword, newPassword);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("settings.passwordChanged"));
      (e.target as HTMLFormElement).reset();
    }
    setPasswordLoading(false);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">{t("settings.title")}</h1>

      <div className="space-y-6">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("settings.profile")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("auth.name")}</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder={t("auth.namePlaceholder")}
                  required
                />
              </div>
              <Button type="submit" disabled={profileLoading}>
                {profileLoading ? t("common.loading") : t("common.save")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Separator />

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("settings.changePassword")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="oldPassword">
                  {t("settings.oldPassword")}
                </Label>
                <Input
                  id="oldPassword"
                  name="oldPassword"
                  type="password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">
                  {t("settings.newPassword")}
                </Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  minLength={8}
                  required
                />
              </div>
              <Button type="submit" disabled={passwordLoading}>
                {passwordLoading ? t("common.loading") : t("common.save")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/rain/code/west-garden/clawhost/portal
pnpm build
```

- [ ] **Step 3: Commit**

```bash
cd /Users/rain/code/west-garden/clawhost
git add portal/src/app/\(dashboard\)/settings/
git commit -m "feat(portal): add settings page with profile and password"
```

---

## Task 14: Dockerfile and final cleanup

**Files:**
- Create: `portal/Dockerfile`
- Create: `portal/.env.example`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
# portal/Dockerfile
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

- [ ] **Step 2: Create .env.example**

```
# portal/.env.example
CLAWHOST_API_URL=http://localhost:18080
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 3: Remove the default Next.js page content**

Delete the default `portal/src/app/page.tsx` that was created by create-next-app (it's now replaced by `(dashboard)/page.tsx`).

Clean up any unused default CSS in `portal/src/app/globals.css` — keep only the Tailwind directives:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Final build verification**

```bash
cd /Users/rain/code/west-garden/clawhost/portal
pnpm build
```

Expected: Clean build with no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/rain/code/west-garden/clawhost
git add portal/Dockerfile portal/.env.example portal/src/app/globals.css
git rm portal/src/app/page.tsx 2>/dev/null; true
git add -A portal/
git commit -m "feat(portal): add Dockerfile and finalize project setup"
```
