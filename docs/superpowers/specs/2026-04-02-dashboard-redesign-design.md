# Dashboard Redesign — Sidebar + Detail Panel with Chat

## Overview

Redesign the ClawHost portal dashboard from the current card-grid listing + separate detail page into a sidebar-based layout with inline agent management and chat. The design references [EasyClaw CloudBot](https://cloudbot.easyclaw.cn/virtual-host) but adapts it for multi-agent support.

## Layout Structure

```
┌──────────┬─────────────────────────────────────────┐
│ Sidebar  │  Agent Header (icon, name, status, meta)│
│          │  [停止] [重启] [WebUI]                    │
│ + New    ├─────────────────────────────────────────┤
│          │  管理  │  对话                            │
│ Agent 1● ├─────────────────────────────────────────┤
│ Agent 2● │                                         │
│ Agent 3● │  Tab content area                       │
│          │  (management scroll / chat interface)    │
│          │                                         │
├──────────┤                                         │
│ User ⚙ ↗│                                         │
└──────────┴─────────────────────────────────────────┘
```

Two-column layout: fixed left sidebar (220px) + flexible right main panel.

## Left Sidebar

**Header**: ClawHost logo (claw icon + gradient text).

**New Agent button**: Prominent `+ New Agent` button below the header. Opens the existing `CreateAgentDialog`.

**Agent list**: Vertical list of all agents. Each item shows:
- Colored initial icon (first letter of agent name, unique gradient per agent)
- Agent name (truncated with ellipsis)
- Status dot: green (running, with glow), red (stopped), yellow pulsing (starting)

Active agent is highlighted with a coral-tinted background and border. Clicking an agent selects it, updating the right panel.

**Footer**: User avatar (initials) + username + settings icon + logout icon.

No separate navigation items (My Agents / Settings). Settings is accessible from the footer gear icon. The sidebar IS the agent list.

## Right Panel — Agent Header (Fixed)

Always visible at the top of the right panel, contains:

**Row 1**: Agent icon + name + status badge + action buttons (停止/重启/WebUI) right-aligned.

**Row 2**: Meta info — ID (truncated), remaining time, version.

**Row 3**: View tabs — `管理` and `对话`, directly below the agent info. The active tab has a coral underline.

The entire header is sticky/fixed. Content below scrolls independently.

## Right Panel — Management Tab

Single scrollable page with card sections, matching the reference site layout:

### 1. Toolbox Section
- Card with header "🔧 工具箱"
- "重置 Agent" item: icon + title + description, clickable

### 2. Connection Info Section
- Card with header "🔗 连接信息"
- Rows: WebUI URL, API endpoint, Access Token (masked)
- Each row has a copy button; token also has a reset button

### 3. Channel Integration Section
- Card with header "📡 渠道集成"
- 2-column grid of channel cards (WeChat, Telegram)
- Each card: channel icon + name + type + "配置指南" link + description + action button
- Connected channels show "✓ 已连接", unconfigured show "配置 [Channel]"
- Clicking triggers existing `WechatQrDialog` or `TelegramDialog`

### 4. Danger Zone Section
- Card with red-tinted border, header "⚠ 危险操作"
- "删除 Agent" item with red styling
- Triggers existing `ConfirmDialog` with typed confirmation

## Right Panel — Chat Tab

Chat interface embedded in the right panel, below the fixed header.

**Warning banner**: Yellow-tinted notification at the top of chat area: "此界面仅为调试入口，不建议日常使用。请配置微信、Telegram等渠道与 Agent 交互。" Dismissible.

**Messages area**: Scrollable chat with bot/user message bubbles.
- Bot messages: left-aligned, dark glass background, coral avatar with agent initial
- User messages: right-aligned, coral-tinted background, dark avatar with user initial
- Standard chat bubble styling with rounded corners

**Input area**: Fixed at bottom.
- Input box with placeholder text
- Send button (coral gradient, arrow icon)
- Footer hint: "内容由 AI 生成，仅供参考"

**Chat implementation**: Proxies to the agent's OpenClaw gateway via the existing `handler/proxy/` WebSocket reverse proxy infrastructure. When agent is not running, show a disabled state with "Agent 未运行" message and a start button.

**Agent switching**: Clicking a different agent in the sidebar while on the chat tab switches to that agent's conversation. Chat history is not persisted client-side — each time you switch to an agent's chat tab, it starts a fresh session. History lives on the agent side.

## Empty State

When no agents exist: centered empty state with ClawIcon, title "创建你的第一个 Agent", description text, and a `+ New Agent` button. Same as current but adapted to the new layout (shown in the right panel area).

## Mobile Behavior

On mobile (< 768px):
- Sidebar collapses to a hamburger menu overlay (similar to current `MobileHeader` behavior)
- Right panel takes full width
- Agent header stacks vertically: name/status on first line, actions on second line
- Chat input area stays fixed at bottom

## Visual Style

No changes to the existing glass morphism design system. Continue using `glass-*` CSS classes from `globals.css`. Colors: deep space background (#050810), coral accent (#ff4d4d), cyan secondary (#00e5cc), glass surfaces with backdrop-blur.

## Routing

Current routes change:
- `/` (dashboard) — now renders the sidebar + detail panel layout. First agent in list is auto-selected, or empty state if no agents.
- `/agents/[id]` — deep link to a specific agent. Sidebar shows with that agent selected.
- `/agents/[id]/chat` — deep link to a specific agent's chat tab.
- `/settings` — navigates to settings page. Sidebar gear icon links here. Settings page uses the same layout shell but without the agent detail panel.

The sidebar agent list is always present. No separate "listing" page.

## Data Flow

- **Agent list**: Fetched server-side in the dashboard layout, passed to sidebar component.
- **Agent detail**: Fetched when an agent is selected. For client-side navigation between agents, use SWR or router transitions.
- **Agent status polling**: Existing `useAgentStatus` hook (5s interval) continues for the selected agent.
- **Channel list**: Existing SWR polling (10s) for the selected agent's channels tab.
- **Chat**: New WebSocket connection to the agent's gateway. Managed per-agent, disconnects on agent switch.

## Components to Modify

| Component | Change |
|---|---|
| `(dashboard)/layout.tsx` | Replace current sidebar+main with new two-column layout |
| `(dashboard)/page.tsx` | Rewrite: sidebar agent list + right panel with management/chat tabs |
| `agents/[id]/overview.tsx` | Refactor into the management tab content |
| `sidebar.tsx` | Rewrite: agent list sidebar instead of nav sidebar |
| `agent-card.tsx` | Remove or repurpose as sidebar agent item |
| `mobile-header.tsx` | Adapt for new sidebar toggle |
| `channel-list.tsx` | Adapt to render within the channels section of management tab |

## New Components

| Component | Purpose |
|---|---|
| `agent-sidebar.tsx` | Left sidebar with agent list, new agent button, user footer |
| `agent-detail-header.tsx` | Fixed header with agent info + view tabs |
| `management-panel.tsx` | Management tab content (toolbox, connection, channels, danger zone) |
| `chat-panel.tsx` | Chat tab content (messages, input, WebSocket connection) |
