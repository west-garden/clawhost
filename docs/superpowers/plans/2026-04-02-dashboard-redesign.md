# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the portal dashboard from card-grid listing + separate detail page into a sidebar agent list + inline detail panel with management/chat tabs.

**Architecture:** Two-column layout with a 220px left sidebar (agent list) and a flexible right panel. The outer `(dashboard)/layout.tsx` fetches the agent list and renders the sidebar. A nested `agents/[id]/layout.tsx` renders the agent detail header with 管理/对话 tabs. Child page routes render tab content. Chat uses the OpenAI-compatible `/v1/chat/completions` endpoint via SSE streaming through the existing proxy.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, SWR, next-intl, lucide-react. No tests (project convention).

**Spec:** `docs/superpowers/specs/2026-04-02-dashboard-redesign-design.md`

---

## File Structure

### New Files
| File | Purpose |
|---|---|
| `portal/src/components/agent-sidebar.tsx` | Left sidebar: logo, new agent button, agent list, user footer |
| `portal/src/components/agent-detail-header.tsx` | Fixed header: agent info + 管理/对话 tabs |
| `portal/src/components/management-panel.tsx` | Management tab: toolbox, connection, channels, danger zone |
| `portal/src/components/chat-panel.tsx` | Chat tab: messages, SSE streaming input, warning banner |
| `portal/src/app/(dashboard)/agents/[id]/layout.tsx` | Nested layout: fetches agent, renders header + tab content |
| `portal/src/app/(dashboard)/agents/[id]/chat/page.tsx` | Chat tab route |
| `portal/src/app/api/agents/[id]/chat/route.ts` | API route: proxies chat completions to agent gateway |

### Modified Files
| File | Change |
|---|---|
| `portal/src/app/(dashboard)/layout.tsx` | Rewrite: fetch agents list, render AgentSidebar + children |
| `portal/src/app/(dashboard)/page.tsx` | Rewrite: redirect to first agent or show empty state |
| `portal/src/app/(dashboard)/agents/[id]/page.tsx` | Rewrite: render ManagementPanel instead of AgentOverview |
| `portal/src/components/mobile-header.tsx` | Adapt: use AgentSidebar content instead of old SidebarContent |
| `portal/src/app/globals.css` | Add new CSS classes for sidebar layout |
| `portal/src/messages/zh.json` | Add chat-related i18n keys |
| `portal/src/messages/en.json` | Add chat-related i18n keys |

### Files to Delete
| File | Reason |
|---|---|
| `portal/src/components/sidebar.tsx` | Replaced by `agent-sidebar.tsx` |
| `portal/src/components/agent-card.tsx` | No longer needed (agent list in sidebar) |
| `portal/src/app/(dashboard)/agents/[id]/overview.tsx` | Replaced by `management-panel.tsx` |
| `portal/src/app/(dashboard)/loading.tsx` | Will recreate if needed after layout change |

---

## Task 1: Add CSS Classes and i18n Keys

**Files:**
- Modify: `portal/src/app/globals.css`
- Modify: `portal/src/messages/zh.json`
- Modify: `portal/src/messages/en.json`

- [ ] **Step 1: Add sidebar CSS classes to globals.css**

Append these inside the existing `@layer components` block in `portal/src/app/globals.css`, after the existing `.glass-nav` styles:

```css
/* Agent sidebar */
.agent-sidebar {
  width: 220px;
  background: rgba(10, 15, 26, 0.8);
  backdrop-filter: blur(20px);
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.agent-sidebar-item {
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.15s;
  border: 1px solid transparent;
}

.agent-sidebar-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

.agent-sidebar-item-active {
  background: rgba(255, 77, 77, 0.1);
  border-color: rgba(255, 77, 77, 0.2);
}

/* Status dots */
.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot-running {
  background: var(--color-claw-cyan);
  box-shadow: 0 0 6px rgba(0, 229, 204, 0.4);
}

.status-dot-stopped {
  background: var(--color-claw-coral);
}

.status-dot-starting {
  background: #f59e0b;
  animation: pulse-dot 1.5s infinite;
}

.status-dot-created {
  background: var(--color-text-muted);
}

.status-dot-error {
  background: var(--color-claw-coral);
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* Agent detail header */
.agent-detail-header {
  background: rgba(10, 15, 26, 0.8);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

/* View tabs */
.view-tab {
  padding: 8px 20px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  color: var(--color-text-muted);
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}

.view-tab:hover {
  color: var(--color-text-secondary);
}

.view-tab-active {
  color: var(--color-claw-coral);
  border-bottom-color: var(--color-claw-coral);
}

/* Chat styles */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chat-bubble {
  padding: 10px 14px;
  font-size: 13px;
  line-height: 1.6;
  border-radius: 12px;
  max-width: 75%;
}

.chat-bubble-bot {
  background: rgba(10, 15, 26, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-top-left-radius: 4px;
  color: var(--color-text-primary);
  align-self: flex-start;
}

.chat-bubble-user {
  background: linear-gradient(135deg, rgba(255, 77, 77, 0.15), rgba(230, 57, 70, 0.1));
  border: 1px solid rgba(255, 77, 77, 0.2);
  border-top-right-radius: 4px;
  color: var(--color-text-primary);
  align-self: flex-end;
}

.chat-input-area {
  padding: 12px 20px 16px;
  background: rgba(10, 15, 26, 0.6);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.chat-warning {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 10px;
  padding: 12px 16px;
}
```

- [ ] **Step 2: Add i18n keys to zh.json**

Add these keys to `portal/src/messages/zh.json`:

Under `"sidebar"`, add:
```json
"newAgent": "新建 Agent"
```

Under `"agent"`, add:
```json
"management": "管理",
"chat": "对话",
"openWebUI": "打开 WebUI",
"upgrade": "升级"
```

Add a new top-level `"chat"` section:
```json
"chat": {
  "warning": "此界面仅为调试入口，不建议日常使用。请配置微信、Telegram 等渠道与 Agent 交互。",
  "inputPlaceholder": "输入消息...",
  "aiDisclaimer": "内容由 AI 生成，仅供参考",
  "notRunning": "Agent 未运行",
  "startToChat": "请先启动 Agent 以开始对话",
  "connecting": "连接中...",
  "connectionError": "连接失败，请重试",
  "send": "发送"
}
```

- [ ] **Step 3: Add i18n keys to en.json**

Add the same structure to `portal/src/messages/en.json`:

Under `"sidebar"`, add:
```json
"newAgent": "New Agent"
```

Under `"agent"`, add:
```json
"management": "Management",
"chat": "Chat",
"openWebUI": "Open WebUI",
"upgrade": "Upgrade"
```

Add a new top-level `"chat"` section:
```json
"chat": {
  "warning": "This is a debug interface only. For daily use, please configure WeChat, Telegram, or other channels.",
  "inputPlaceholder": "Type a message...",
  "aiDisclaimer": "Content generated by AI, for reference only",
  "notRunning": "Agent is not running",
  "startToChat": "Start the agent to begin chatting",
  "connecting": "Connecting...",
  "connectionError": "Connection failed, please retry",
  "send": "Send"
}
```

- [ ] **Step 4: Commit**

```bash
git add portal/src/app/globals.css portal/src/messages/zh.json portal/src/messages/en.json
git commit -m "feat(portal): add CSS classes and i18n keys for dashboard redesign"
```

---

## Task 2: Create AgentSidebar Component

**Files:**
- Create: `portal/src/components/agent-sidebar.tsx`

- [ ] **Step 1: Write the AgentSidebar component**

```tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { CreateAgentDialog } from "./create-agent-dialog";
import { LocaleSwitcher } from "./locale-switcher";
import { ClawIcon } from "./claw-icon";
import { Plus, Settings, LogOut } from "lucide-react";
import type { Agent, User } from "@/types";

// Deterministic color gradients based on agent name
const AGENT_COLORS = [
  "from-red-500 to-red-700",
  "from-blue-500 to-blue-700",
  "from-purple-500 to-purple-700",
  "from-amber-500 to-amber-700",
  "from-emerald-500 to-emerald-700",
  "from-pink-500 to-pink-700",
  "from-cyan-500 to-cyan-700",
  "from-orange-500 to-orange-700",
];

function getAgentColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length];
}

function getStatusDotClass(status: string): string {
  const map: Record<string, string> = {
    running: "status-dot-running",
    stopped: "status-dot-stopped",
    starting: "status-dot-starting",
    created: "status-dot-created",
    error: "status-dot-error",
  };
  return map[status] || "status-dot-created";
}

interface AgentSidebarContentProps {
  agents: Agent[];
  user: User;
  locale: string;
  onNavigate?: () => void;
}

export function AgentSidebarContent({
  agents,
  user,
  locale,
  onNavigate,
}: AgentSidebarContentProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();

  const activeAgentId = pathname.match(/\/agents\/([^/]+)/)?.[1];

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
          <ClawIcon className="w-5 h-5" />
        </div>
        <span className="font-semibold text-base text-white">ClawHost</span>
      </div>

      {/* New Agent button */}
      <div className="px-3 pt-3 pb-1">
        <CreateAgentDialog>
          <button className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-gradient-to-r from-red-500/20 to-red-700/20 border border-red-500/30 text-red-400 text-xs font-medium hover:from-red-500/30 hover:to-red-700/30 transition-all">
            <Plus className="w-3.5 h-3.5" />
            {t("sidebar.newAgent")}
          </button>
        </CreateAgentDialog>
      </div>

      {/* Agent list label */}
      <div className="px-4 pt-4 pb-2 text-[10px] uppercase tracking-widest text-white/30">
        Agents
      </div>

      {/* Agent list */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {agents.map((agent) => {
          const isActive = agent.id === activeAgentId;
          const initial = (agent.name || "?")[0].toUpperCase();
          const color = getAgentColor(agent.name);

          return (
            <a
              key={agent.id}
              href={`/agents/${agent.id}`}
              onClick={(e) => {
                e.preventDefault();
                onNavigate?.();
                router.push(`/agents/${agent.id}`);
              }}
              className={cn(
                "agent-sidebar-item",
                isActive && "agent-sidebar-item-active"
              )}
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-md bg-gradient-to-br flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0",
                  color
                )}
              >
                {initial}
              </div>
              <span
                className={cn(
                  "text-[13px] font-medium flex-1 truncate",
                  isActive ? "text-white" : "text-white/50"
                )}
              >
                {agent.name}
              </span>
              <div
                className={cn("status-dot", getStatusDotClass(agent.status))}
              />
            </a>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-3 space-y-3">
        <div className="flex items-center gap-2.5 px-1">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-red-500/20 to-red-700/20 border border-white/10 flex items-center justify-center">
            <span className="text-[10px] font-medium text-white">
              {(user.name || user.email || "?").slice(0, 2).toUpperCase()}
            </span>
          </div>
          <span className="text-xs text-white/60 truncate flex-1">
            {user.name || user.email}
          </span>
          <LocaleSwitcher locale={locale} />
        </div>
        <div className="flex gap-2">
          <a
            href="/settings"
            onClick={(e) => {
              e.preventDefault();
              onNavigate?.();
              router.push("/settings");
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs hover:bg-white/10 hover:text-white/70 transition-all"
          >
            <Settings className="w-3.5 h-3.5" />
            {t("sidebar.settings")}
          </a>
          <button
            onClick={handleLogout}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t("sidebar.logout")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AgentSidebar({
  agents,
  user,
  locale,
}: {
  agents: Agent[];
  user: User;
  locale: string;
}) {
  return (
    <aside className="hidden md:flex h-full agent-sidebar">
      <AgentSidebarContent agents={agents} user={user} locale={locale} />
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/components/agent-sidebar.tsx
git commit -m "feat(portal): add AgentSidebar component with agent list"
```

---

## Task 3: Rewrite Dashboard Layout and Root Page

**Files:**
- Modify: `portal/src/app/(dashboard)/layout.tsx`
- Modify: `portal/src/app/(dashboard)/page.tsx`
- Modify: `portal/src/components/mobile-header.tsx`

- [ ] **Step 1: Rewrite dashboard layout**

Replace the entire `portal/src/app/(dashboard)/layout.tsx` with:

```tsx
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getProfile, listAgents, ApiError } from "@/lib/api";
import { AgentSidebar } from "@/components/agent-sidebar";
import { MobileHeader } from "@/components/mobile-header";

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
  const agents = await listAgents();

  return (
    <div className="flex h-screen glass-bg">
      <AgentSidebar agents={agents} user={user} locale={locale} />
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <MobileHeader agents={agents} user={user} locale={locale} />
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite the root dashboard page**

Replace the entire `portal/src/app/(dashboard)/page.tsx` with:

```tsx
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { listAgents } from "@/lib/api";
import { CreateAgentDialog } from "@/components/create-agent-dialog";
import { ClawIcon } from "@/components/claw-icon";
import { Plus } from "lucide-react";

export default async function DashboardPage() {
  const agents = await listAgents();

  // If agents exist, redirect to the first one
  if (agents.length > 0) {
    redirect(`/agents/${agents[0].id}`);
  }

  // Empty state
  const t = await getTranslations("dashboard");

  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-red-500/20 to-red-700/20 border border-white/10 flex items-center justify-center mb-6 backdrop-blur-xl mx-auto">
          <ClawIcon className="w-14 h-14" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">
          {t("emptyTitle")}
        </h2>
        <p className="text-sm text-white/50 mb-8 max-w-sm mx-auto">
          {t("emptyDescription")}
        </p>
        <CreateAgentDialog>
          <button className="glass-btn text-base py-4 px-8">
            <Plus className="w-5 h-5" />
            {t("createAgent")}
          </button>
        </CreateAgentDialog>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Adapt MobileHeader for new sidebar**

Replace the entire `portal/src/components/mobile-header.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { AgentSidebarContent } from "./agent-sidebar";
import type { Agent, User } from "@/types";
import { ClawIcon } from "./claw-icon";
import { Menu } from "lucide-react";

export function MobileHeader({
  agents,
  user,
  locale,
}: {
  agents: Agent[];
  user: User;
  locale: string;
}) {
  const [open, setOpen] = useState(false);

  const initials = (user.name || user.email || "?")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      {/* Mobile header bar */}
      <header className="flex md:hidden items-center justify-between glass-header px-4 h-14 sticky top-0 z-30">
        <button
          onClick={() => setOpen(true)}
          className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:bg-white/10 transition-all"
          aria-label="Menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
            <ClawIcon className="w-4 h-4" />
          </div>
          <span className="font-semibold text-sm text-white">ClawHost</span>
        </div>

        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500/20 to-red-700/20 border border-white/10 flex items-center justify-center">
          <span className="text-[10px] font-medium text-white">{initials}</span>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="fixed top-0 left-0 bottom-0 w-[260px] agent-sidebar z-50 md:hidden">
            <AgentSidebarContent
              agents={agents}
              user={user}
              locale={locale}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add portal/src/app/\(dashboard\)/layout.tsx portal/src/app/\(dashboard\)/page.tsx portal/src/components/mobile-header.tsx
git commit -m "feat(portal): rewrite dashboard layout with agent sidebar"
```

---

## Task 4: Create Agent Detail Header Component

**Files:**
- Create: `portal/src/components/agent-detail-header.tsx`

- [ ] **Step 1: Write the AgentDetailHeader component**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { AgentStatusBadge } from "./agent-status-badge";
import type { AgentStatus } from "@/types";
import { Square, RotateCw, Play, ExternalLink } from "lucide-react";

interface AgentDetailHeaderProps {
  agentId: string;
  agentName: string;
  agentSlug: string;
  currentStatus: AgentStatus;
  webchatUrl?: string;
  actionLoading: string | null;
  onAction: (action: "start" | "stop" | "restart") => void;
}

export function AgentDetailHeader({
  agentId,
  agentName,
  agentSlug,
  currentStatus,
  webchatUrl,
  actionLoading,
  onAction,
}: AgentDetailHeaderProps) {
  const t = useTranslations();
  const pathname = usePathname();

  const initial = (agentName || "?")[0].toUpperCase();
  const isChatTab = pathname.endsWith("/chat");

  return (
    <div className="agent-detail-header">
      {/* Agent info row */}
      <div className="px-5 pt-4 pb-0 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-base font-semibold text-white truncate">
              {agentName}
            </h1>
            <AgentStatusBadge status={currentStatus} />
          </div>
          <p className="text-[11px] text-white/30 font-mono truncate">
            {agentSlug} · ID: {agentId.slice(0, 12)}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-1.5 flex-shrink-0">
          {currentStatus !== "running" && currentStatus !== "starting" && (
            <button
              onClick={() => onAction("start")}
              disabled={actionLoading !== null}
              className="glass-btn py-1.5 px-3 text-xs"
            >
              <Play className="w-3.5 h-3.5" />
              <span>
                {actionLoading === "start"
                  ? t("agent.actions.starting")
                  : t("agent.actions.start")}
              </span>
            </button>
          )}
          {currentStatus === "running" && (
            <>
              <button
                onClick={() => onAction("stop")}
                disabled={actionLoading !== null}
                className="glass-btn-secondary py-1.5 px-3 text-xs"
              >
                <Square className="w-3 h-3" />
                <span>
                  {actionLoading === "stop"
                    ? t("agent.actions.stopping")
                    : t("agent.actions.stop")}
                </span>
              </button>
              <button
                onClick={() => onAction("restart")}
                disabled={actionLoading !== null}
                className="glass-btn-secondary py-1.5 px-3 text-xs"
              >
                <RotateCw className="w-3 h-3" />
                <span>
                  {actionLoading === "restart"
                    ? t("agent.actions.restarting")
                    : t("agent.actions.restart")}
                </span>
              </button>
            </>
          )}
          {webchatUrl && (
            <a
              href={webchatUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-btn-secondary py-1.5 px-3 text-xs"
            >
              <ExternalLink className="w-3 h-3" />
              <span>WebUI</span>
            </a>
          )}
        </div>
      </div>

      {/* View tabs */}
      <div className="flex gap-0 px-5 mt-3">
        <Link
          href={`/agents/${agentId}`}
          className={cn(
            "view-tab",
            !isChatTab && "view-tab-active"
          )}
        >
          {t("agent.management")}
        </Link>
        <Link
          href={`/agents/${agentId}/chat`}
          className={cn(
            "view-tab",
            isChatTab && "view-tab-active"
          )}
        >
          {t("agent.chat")}
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/components/agent-detail-header.tsx
git commit -m "feat(portal): add AgentDetailHeader with management/chat tabs"
```

---

## Task 5: Create Agent Detail Layout and Management Panel

**Files:**
- Create: `portal/src/app/(dashboard)/agents/[id]/layout.tsx`
- Create: `portal/src/components/management-panel.tsx`
- Modify: `portal/src/app/(dashboard)/agents/[id]/page.tsx`

- [ ] **Step 1: Create the agent detail nested layout**

Create `portal/src/app/(dashboard)/agents/[id]/layout.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getAgent, getAgentConnect, ApiError } from "@/lib/api";
import { AgentDetailClient } from "./client";

export default async function AgentDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
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

  return (
    <AgentDetailClient agent={agent} connectInfo={connectInfo}>
      {children}
    </AgentDetailClient>
  );
}
```

- [ ] **Step 2: Create the client wrapper for the agent detail layout**

Create `portal/src/app/(dashboard)/agents/[id]/client.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { AgentDetailHeader } from "@/components/agent-detail-header";
import { useAgentStatus } from "@/hooks/use-agent-status";
import { startAgent, stopAgent, restartAgent } from "@/lib/actions";
import type { AgentDetail, AgentConnectResponse } from "@/types";

export function AgentDetailClient({
  agent,
  connectInfo,
  children,
}: {
  agent: AgentDetail;
  connectInfo: AgentConnectResponse | null;
  children: React.ReactNode;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pollEnabled, setPollEnabled] = useState(
    agent.status === "running" || agent.status === "starting"
  );

  const { status: liveStatus } = useAgentStatus(agent.id, pollEnabled);
  const currentStatus = liveStatus?.status ?? agent.status;

  const [prevStatus, setPrevStatus] = useState(currentStatus);
  useEffect(() => {
    if (prevStatus !== "running" && currentStatus === "running") {
      router.refresh();
    }
    setPrevStatus(currentStatus);
  }, [currentStatus, prevStatus, router]);

  async function handleAction(action: "start" | "stop" | "restart") {
    const fns = { start: startAgent, stop: stopAgent, restart: restartAgent };
    setActionLoading(action);
    const result = await fns[action](agent.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t(`agent.${action}Success`));
      setPollEnabled(true);
      router.refresh();
    }
    setActionLoading(null);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <AgentDetailHeader
        agentId={agent.id}
        agentName={agent.name}
        agentSlug={agent.slug}
        currentStatus={currentStatus}
        webchatUrl={connectInfo?.webchat_url}
        actionLoading={actionLoading}
        onAction={handleAction}
      />
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Create the ManagementPanel component**

Create `portal/src/components/management-panel.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfirmDialog } from "./confirm-dialog";
import { ChannelList } from "./channel-list";
import { useAgentStatus } from "@/hooks/use-agent-status";
import { deleteAgent, resetAgentToken } from "@/lib/actions";
import type { AgentDetail, AgentConnectResponse } from "@/types";
import {
  Copy,
  RefreshCw,
  ExternalLink,
  Trash2,
  AlertTriangle,
  Link2,
  RotateCcw,
} from "lucide-react";

export function ManagementPanel({
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

  const { status: liveStatus } = useAgentStatus(agent.id, true);
  const currentStatus = liveStatus?.status ?? agent.status;

  async function handleDelete() {
    setActionLoading("delete");
    const result = await deleteAgent(agent.id);
    if (result?.error) {
      toast.error(result.error);
      setActionLoading(null);
    } else {
      toast.success(t("agent.danger.deleted"));
      router.push("/");
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
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      {/* Toolbox */}
      <div className="glass-panel">
        <div className="glass-panel-header">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-red-400" />
            <span className="font-medium text-white text-sm">
              {t("agent.toolbox", { defaultMessage: "工具箱" })}
            </span>
          </div>
        </div>
        <div className="glass-panel-content">
          <button className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] hover:bg-white/5 transition-colors text-left">
            <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
              <RotateCcw className="w-4 h-4 text-white/50" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">重置 Agent</p>
              <p className="text-xs text-white/40">
                强制重启 Agent，清除所有运行状态
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Connection Info */}
      {connectInfo && currentStatus === "running" && (
        <div className="glass-panel">
          <div className="glass-panel-header">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-red-400" />
              <span className="font-medium text-white text-sm">
                {t("agent.connect.webui")}
              </span>
            </div>
          </div>
          <div className="glass-panel-content space-y-3">
            {connectInfo.webchat_url && (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white/60 uppercase tracking-wider mb-1">
                    WebUI
                  </p>
                  <p className="text-xs text-white/40 truncate font-mono">
                    {connectInfo.webchat_url}
                  </p>
                </div>
                <button
                  onClick={() =>
                    window.open(connectInfo.webchat_url, "_blank")
                  }
                  className="glass-btn-secondary py-1.5 px-3 text-xs shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{t("common.open")}</span>
                </button>
              </div>
            )}

            <div className="h-px bg-white/5" />

            {connectInfo.endpoint && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white/60 uppercase tracking-wider mb-1">
                      {t("agent.connect.apiEndpoint")}
                    </p>
                    <p className="text-xs text-white/40 truncate font-mono">
                      {connectInfo.endpoint}
                    </p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(connectInfo.endpoint!)}
                    className="glass-btn-secondary py-1.5 px-3 text-xs shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{t("common.copy")}</span>
                  </button>
                </div>
                <div className="h-px bg-white/5" />
              </>
            )}

            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-white/60 uppercase tracking-wider mb-1">
                  {t("agent.connect.accessToken")}
                </p>
                <p className="text-xs text-white/40 font-mono">
                  {agent.access_token.slice(0, 8)}••••••••
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => copyToClipboard(agent.access_token)}
                  className="glass-btn-secondary py-1.5 px-3 text-xs"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setResetTokenOpen(true)}
                  className="glass-btn-secondary py-1.5 px-3 text-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Channels */}
      <ChannelList agentId={agent.id} agentStatus={currentStatus} />

      {/* Danger Zone */}
      <div className="glass-panel border-red-500/20">
        <div className="glass-panel-header border-b-red-500/10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="font-medium text-red-400 text-sm">
              {t("agent.danger.title")}
            </span>
          </div>
        </div>
        <div className="glass-panel-content">
          <button
            onClick={() => setDeleteOpen(true)}
            className="flex items-center gap-3 p-3 rounded-lg border border-red-500/15 hover:bg-red-500/5 transition-colors w-full text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-red-400">
                {t("agent.danger.deleteAgent")}
              </p>
              <p className="text-xs text-white/40">
                永久删除此 Agent 及其所有数据，此操作不可撤销
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Dialogs */}
      <ConfirmDialog
        open={resetTokenOpen}
        onOpenChange={setResetTokenOpen}
        title={t("agent.connect.resetToken")}
        description={t("agent.connect.resetTokenConfirm")}
        loading={actionLoading === "resetToken"}
        onConfirm={handleResetToken}
      />
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

- [ ] **Step 4: Rewrite the agent detail page to use ManagementPanel**

Replace the entire `portal/src/app/(dashboard)/agents/[id]/page.tsx` with:

```tsx
import { notFound } from "next/navigation";
import { getAgent, getAgentConnect, ApiError } from "@/lib/api";
import { ManagementPanel } from "@/components/management-panel";

export default async function AgentManagementPage({
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
      // Connect info not available yet
    }
  }

  return <ManagementPanel agent={agent} connectInfo={connectInfo} />;
}
```

- [ ] **Step 5: Commit**

```bash
git add portal/src/app/\(dashboard\)/agents/\[id\]/layout.tsx portal/src/app/\(dashboard\)/agents/\[id\]/client.tsx portal/src/components/management-panel.tsx portal/src/app/\(dashboard\)/agents/\[id\]/page.tsx
git commit -m "feat(portal): add agent detail layout with management panel"
```

---

## Task 6: Create Chat Panel and API Route

**Files:**
- Create: `portal/src/components/chat-panel.tsx`
- Create: `portal/src/app/(dashboard)/agents/[id]/chat/page.tsx`
- Create: `portal/src/app/api/agents/[id]/chat/route.ts`

- [ ] **Step 1: Create the chat API route**

Create `portal/src/app/api/agents/[id]/chat/route.ts`:

```ts
import { getAccessToken } from "@/lib/auth";
import { fetchApi } from "@/lib/api";
import type { AgentConnectResponse } from "@/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = await getAccessToken();
  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get agent connect info to find the proxy URL
  let connectInfo: AgentConnectResponse;
  try {
    connectInfo = await fetchApi<AgentConnectResponse>(
      `/api/v1/agents/${id}/connect`
    );
  } catch {
    return Response.json(
      { error: "Agent not available" },
      { status: 503 }
    );
  }

  if (!connectInfo.endpoint) {
    return Response.json(
      { error: "Agent not running" },
      { status: 503 }
    );
  }

  const body = await request.json();

  // Proxy to the agent's OpenAI-compatible chat completions endpoint
  const agentUrl = `${connectInfo.endpoint}/v1/chat/completions`;

  const agentRes = await fetch(agentUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${connectInfo.token}`,
    },
    body: JSON.stringify({
      ...body,
      stream: true,
    }),
  });

  if (!agentRes.ok) {
    const errText = await agentRes.text().catch(() => "Unknown error");
    return Response.json(
      { error: errText },
      { status: agentRes.status }
    );
  }

  // Stream the SSE response through
  return new Response(agentRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Create the ChatPanel component**

Create `portal/src/components/chat-panel.tsx`:

```tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAgentStatus } from "@/hooks/use-agent-status";
import { startAgent } from "@/lib/actions";
import { toast } from "sonner";
import type { AgentStatus } from "@/types";
import { Send, AlertTriangle, Play, X, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ChatPanel({
  agentId,
  agentName,
  initialStatus,
}: {
  agentId: string;
  agentName: string;
  initialStatus: AgentStatus;
}) {
  const t = useTranslations("chat");
  const ta = useTranslations("agent");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { status: liveStatus } = useAgentStatus(agentId, true);
  const currentStatus = liveStatus?.status ?? initialStatus;
  const isRunning = currentStatus === "running";

  const initial = (agentName || "?")[0].toUpperCase();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function handleStart() {
    setStartLoading(true);
    const result = await startAgent(agentId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(ta("startSuccess"));
    }
    setStartLoading(false);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || isStreaming || !isRunning) return;

    const userMessage: Message = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);

    // Add empty assistant message for streaming
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  accumulated += delta;
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      role: "assistant",
                      content: accumulated,
                    };
                    return updated;
                  });
                }
              } catch {
                // Skip non-JSON lines
              }
            }
          }
        }
      }
    } catch (err) {
      toast.error(t("connectionError"));
      // Remove the empty assistant message on error
      setMessages((prev) => {
        if (prev[prev.length - 1]?.content === "") {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Not running state
  if (!isRunning) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-white/20" />
          </div>
          <p className="text-sm font-medium text-white/60 mb-1">
            {t("notRunning")}
          </p>
          <p className="text-xs text-white/30 mb-4">{t("startToChat")}</p>
          <button
            onClick={handleStart}
            disabled={startLoading}
            className="glass-btn py-2 px-4 text-sm"
          >
            {startLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span>
              {startLoading ? ta("actions.starting") : ta("actions.start")}
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Messages */}
      <div className="chat-messages">
        {/* Warning banner */}
        {!warningDismissed && (
          <div className="chat-warning">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-400/90 leading-relaxed flex-1">
              {t("warning")}
            </p>
            <button
              onClick={() => setWarningDismissed(true)}
              className="text-amber-400/50 hover:text-amber-400 flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2.5 items-start ${
              msg.role === "user" ? "flex-row-reverse" : ""
            }`}
          >
            <div
              className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-semibold flex-shrink-0 mt-0.5 ${
                msg.role === "assistant"
                  ? "bg-gradient-to-br from-red-500 to-red-700 text-white"
                  : "bg-gradient-to-br from-slate-700 to-slate-800 text-white/60"
              }`}
            >
              {msg.role === "assistant" ? initial : "U"}
            </div>
            <div
              className={
                msg.role === "assistant"
                  ? "chat-bubble chat-bubble-bot"
                  : "chat-bubble chat-bubble-user"
              }
            >
              {msg.content || (
                <Loader2 className="w-4 h-4 animate-spin text-white/30" />
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <div className="flex items-end gap-2.5 bg-white/[0.04] border border-white/10 rounded-xl p-2.5 focus-within:border-red-500/40 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("inputPlaceholder")}
            rows={1}
            className="flex-1 bg-transparent text-sm text-white placeholder-white/30 resize-none outline-none max-h-32 leading-relaxed"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-white/20 mt-2 text-center">
          {t("aiDisclaimer")}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the chat page route**

Create `portal/src/app/(dashboard)/agents/[id]/chat/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getAgent, ApiError } from "@/lib/api";
import { ChatPanel } from "@/components/chat-panel";

export default async function AgentChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let agent;
  try {
    agent = await getAgent(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      notFound();
    }
    throw e;
  }

  return (
    <ChatPanel
      agentId={agent.id}
      agentName={agent.name}
      initialStatus={agent.status}
    />
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add portal/src/components/chat-panel.tsx portal/src/app/\(dashboard\)/agents/\[id\]/chat/page.tsx portal/src/app/api/agents/\[id\]/chat/route.ts
git commit -m "feat(portal): add chat panel with SSE streaming"
```

---

## Task 7: Delete Old Files and Clean Up

**Files:**
- Delete: `portal/src/components/sidebar.tsx`
- Delete: `portal/src/components/agent-card.tsx`
- Delete: `portal/src/app/(dashboard)/agents/[id]/overview.tsx`
- Delete: `portal/src/app/(dashboard)/loading.tsx`

- [ ] **Step 1: Delete obsolete files**

```bash
rm portal/src/components/sidebar.tsx
rm portal/src/components/agent-card.tsx
rm portal/src/app/\(dashboard\)/agents/\[id\]/overview.tsx
rm -f portal/src/app/\(dashboard\)/loading.tsx
```

- [ ] **Step 2: Check for broken imports**

Run:
```bash
cd portal && npx next build 2>&1 | head -80
```

If any imports reference deleted files (`sidebar.tsx`, `agent-card.tsx`, `overview.tsx`), fix them. The main places to check:
- `mobile-header.tsx` should import from `agent-sidebar.tsx` (already done in Task 3)
- `agents/[id]/page.tsx` should NOT import from `overview.tsx` (already rewritten in Task 5)

- [ ] **Step 3: Fix any build errors found in Step 2**

Address any remaining issues. Common fixes:
- Remove unused imports
- Fix any type mismatches between the new layout's data passing and component props

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(portal): remove old sidebar, agent-card, and overview components"
```

---

## Task 8: Verify and Polish

- [ ] **Step 1: Run a full build**

```bash
cd portal && npx next build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Manual verification checklist**

Start the dev server and verify:

```bash
cd portal && npm run dev
```

Check in browser:
1. `/` — redirects to `/agents/[first-id]` (or shows empty state if no agents)
2. Left sidebar shows all agents with status dots
3. Clicking an agent in sidebar updates right panel
4. Management tab: toolbox, connection info, channels, danger zone all render
5. Chat tab: warning banner shows, can send messages (if agent running)
6. New Agent button in sidebar opens create dialog
7. Mobile (resize to < 768px): hamburger menu opens sidebar overlay
8. Settings link in sidebar footer navigates to `/settings`

- [ ] **Step 3: Commit any polish fixes**

```bash
git add -A
git commit -m "fix(portal): polish dashboard redesign"
```
