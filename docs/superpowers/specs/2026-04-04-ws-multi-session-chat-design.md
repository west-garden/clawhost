# WebSocket 多会话聊天设计

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 ClawHost 的多会话聊天从 localStorage + HTTP SSE 改为完全基于 WebSocket，实现会话和消息的服务端存储与同步。

**Architecture:** 前端通过 WebSocket 连接 OpenClaw Gateway，使用 `sessions.list`、`chat.history`、`chat.send` 等 JSON-RPC 方法管理会话和消息。会话数据存储在 Gateway，前端只负责显示和交互。

**Tech Stack:** React Hooks, WebSocket, JSON-RPC, OpenClaw Gateway Protocol

---

## 1. 当前架构 vs 目标架构

### 当前架构
```
┌─────────────┐     HTTP POST      ┌─────────────┐
│   Portal    │ ──────────────────>│  ClawHost   │
│  (Browser)  │     /chat (SSE)    │   Backend   │
└─────────────┘                    └─────────────┘
       │
       │ localStorage
       ▼
┌─────────────┐
│   Sessions  │  (仅本地，不同步)
└─────────────┘
```

### 目标架构（参考 WestClaw）
```
┌─────────────┐  /connect (获取 ws_url+token)  ┌─────────────┐
│   Portal    │ ─────────────────────────────>│  ClawHost   │
│  (Browser)  │                                │   Backend   │
└─────────────┘                                └─────────────┘
       │
       │ WebSocket (JSON-RPC)
       ▼
┌─────────────────────────────────────────────────────────┐
│                   OpenClaw Gateway                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  sessions.  │  │   chat.     │  │   agent.    │     │
│  │  list       │  │   history   │  │   identity  │     │
│  │  create     │  │   send      │  │             │     │
│  │  archive    │  │   abort     │  │             │     │
│  │  reset      │  │             │  │             │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                         │                               │
│                         ▼                               │
│              ┌─────────────────────┐                   │
│              │   Session Storage   │                   │
│              │   (持久化)          │                   │
│              └─────────────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Gateway JSON-RPC 方法

ClawHost 前端需要调用的 OpenClaw Gateway 方法：

| 方法 | 功能 | 参数 |
|-----|------|-----|
| `sessions.list` | 获取会话列表 | `{ includeDerivedTitles?: boolean }` |
| `chat.history` | 获取消息历史 | `{ sessionKey: string, limit?: number }` |
| `chat.send` | 发送消息 | `{ sessionKey: string, message: string, idempotencyKey?: string }` |
| `chat.abort` | 中止生成 | `{ sessionKey: string, runId: string }` |
| `sessions.reset` | 重置会话 | `{ key: string }` |

### Gateway 事件（通过 `onEvent` 回调接收）

| 事件 | 含义 | Payload |
|-----|------|---------|
| `chat` | 聊天事件 | `{ state: "delta"|"final"|"error"|"aborted", runId, sessionKey, message?, errorMessage? }` |
| `agent` | Agent 生命周期 | `{ stream: "lifecycle"|"tool"|"assistant", runId, sessionKey, data }` |
| `heartbeat` | 心跳完成 | `{ status: string }` |

---

## 3. 文件改动清单

### 3.1 新建文件

| 文件 | 功能 |
|-----|------|
| `portal/src/hooks/use-ws-chat-sessions.ts` | WebSocket 会话管理 hook（替代 `use-chat-sessions.ts`） |
| `portal/src/hooks/use-ws-chat.ts` | WebSocket 聊天 hook（处理消息发送、事件监听） |

### 3.2 修改文件

| 文件 | 改动 |
|-----|------|
| `portal/src/hooks/use-gateway-connection.ts` | 扩展：暴露 `client` 供聊天使用，添加事件回调注册 |
| `portal/src/components/chat-panel.tsx` | 改用 WebSocket 发送消息和接收响应 |
| `portal/src/components/chat-page-client.tsx` | 使用新的 `use-ws-chat-sessions` hook |
| `portal/src/components/chat-session-sidebar.tsx` | 适配新的会话数据结构 |

### 3.3 可删除文件

| 文件 | 原因 |
|-----|------|
| `portal/src/lib/chat-storage.ts` | localStorage 不再需要（可选保留作为离线缓存） |
| `portal/src/app/api/agents/[id]/chat/route.ts` | HTTP SSE 聊天不再需要 |
| `portal/src/hooks/use-chat-sessions.ts` | 被 `use-ws-chat-sessions.ts` 替代 |

---

## 4. 数据结构

### 4.1 Gateway 会话（从 `sessions.list` 返回）

```typescript
interface GatewaySession {
  key: string;                    // 会话唯一标识，如 "agent:main:panel-abc123"
  displayName?: string;           // 显示名称
  derivedTitle?: string;          // 从首条消息推导的标题
  kind?: string;                  // 会话类型
  channel?: string;               // 来源渠道 (wechat, telegram, panel)
  lastChannel?: string;           // 最后使用的渠道
  updatedAt?: number;             // 最后更新时间
  totalTokens?: number;           // 当前 token 数
  totalTokensFresh?: boolean;     // token 数是否新鲜
}
```

### 4.2 Gateway 消息（从 `chat.history` 返回）

```typescript
interface GatewayMessage {
  role: "user" | "assistant";
  content: string | Array<{ type: "text"; text: string }>;
  timestamp?: number;
  idempotencyKey?: string;        // 用于匹配用户消息
}
```

### 4.3 前端 ChatSession（适配 Gateway）

```typescript
interface ChatSession {
  key: string;                    // 对应 Gateway 的 sessionKey
  title: string;                  // derivedTitle 或自定义标题
  messages: ChatMessage[];
  model?: string;                 // 当前使用的模型
  createdAt: number;
  updatedAt: number;
  unread?: boolean;               // 是否有未读消息（非活跃会话收到新消息）
}
```

---

## 5. Hook 设计

### 5.1 `use-gateway-connection.ts` 扩展

```typescript
interface UseGatewayConnectionOptions {
  agentId: string;
  enabled: boolean;
  onEvent?: (evt: GatewayEvent) => void;  // 新增：事件回调
}

interface UseGatewayConnectionReturn {
  connectionState: ConnectionState;
  client: GatewayClient | null;           // 新增：暴露 client
  reconnect: () => void;
}

// 改动：
// 1. 接收 onEvent 回调，传递给 GatewayClient
// 2. 暴露 client 实例供聊天使用
```

### 5.2 `use-ws-chat-sessions.ts`

参考 WestClaw 的 `useSessionManager.ts`：

```typescript
interface UseWsChatSessionsOptions {
  client: GatewayClient | null;
  connected: boolean;
  onSessionChange?: (sessionKey: string) => void;
}

interface UseWsChatSessionsReturn {
  sessions: ChatSession[];
  activeSessionKey: string;
  isLoading: boolean;
  switchSession: (key: string) => Promise<void>;
  createNewSession: () => void;
  archiveSession: (key: string) => void;
  refreshSessions: () => void;
}

// 核心逻辑：
// 1. 连接后调用 sessions.list 获取列表
// 2. 切换会话时调用 chat.history 加载历史
// 3. 监听 chat 事件更新未读状态
// 4. 使用 LRU 缓存避免重复加载历史
```

### 5.3 `use-ws-chat.ts`

```typescript
interface UseWsChatOptions {
  client: GatewayClient | null;
  connected: boolean;
  sessionKey: string;
}

interface UseWsChatReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  sendMessage: (text: string) => void;
  abortGeneration: () => void;
}

// 核心逻辑：
// 1. 监听 chat 事件处理 delta/final/error
// 2. sendMessage 调用 chat.send
// 3. 处理流式文本累积
```

---

## 6. 组件改动

### 6.1 `chat-page-client.tsx`

```tsx
// 之前：使用 localStorage 的会话
const { sessions, activeSession, ... } = useChatSessions({ agentId, defaultModel });

// 之后：使用 WebSocket 的会话
const { connectionState, client } = useGatewayConnection({
  agentId,
  enabled: isRunning,
  onEvent: handleGatewayEvent,
});

const { sessions, activeSessionKey, switchSession, ... } = useWsChatSessions({
  client,
  connected: connectionState === "connected",
});

const { messages, sendMessage, isStreaming } = useWsChat({
  client,
  connected: connectionState === "connected",
  sessionKey: activeSessionKey,
});
```

### 6.2 `chat-panel.tsx`

```tsx
// 之前：HTTP POST 发送消息
const res = await fetch(`/api/agents/${agentId}/chat`, { method: "POST", ... });

// 之后：WebSocket 发送消息
sendMessage(text);

// 流式响应通过事件处理：
// - chat.delta: 累积文本
// - chat.final: 完成消息
// - chat.error: 错误处理
```

---

## 7. 事件处理流程

### 7.1 发送消息流程

```
用户输入 → sendMessage()
           │
           ▼
    client.request("chat.send", {
      sessionKey,
      message: text,
      idempotencyKey
    })
           │
           ▼
    Gateway 处理并返回确认
           │
           ▼
    Gateway 发送 chat 事件:
    - delta: 流式文本
    - final: 完整响应
    - error: 错误
```

### 7.2 接收消息流程（其他渠道）

```
用户在微信/Telegram 发送消息
           │
           ▼
    Gateway 发送 chat 事件:
    { state: "delta", sessionKey, runId, message }
           │
           ▼
    onEvent 回调判断:
    - 如果是活跃会话 → 更新 messages
    - 如果是非活跃会话 → 标记 unread
```

---

## 8. 简化设计（vs WestClaw）

WestClaw 有一些 ClawHost 暂时不需要的功能：

| 功能 | WestClaw | ClawHost |
|-----|----------|----------|
| 会话置顶 | ✅ SQLite | ❌ 暂不需要 |
| 自定义标题 | ✅ SQLite | ❌ 暂不需要 |
| 会话归档 | ✅ SQLite | ✅ 本地状态即可 |
| 拖拽排序 | ✅ localStorage | ❌ 暂不需要 |
| 工具事件显示 | ✅ 复杂 UI | ❌ 暂不需要 |
| 外部渠道消息 | ✅ SSE bridge | ❌ 暂不需要 |
| 图片附件 | ✅ base64 | ❌ 暂不需要 |

ClawHost 先实现核心功能：会话列表 + 消息发送/接收 + 流式响应。

---

## 9. 实现步骤

### Task 1: 扩展 `use-gateway-connection.ts`
- 添加 `onEvent` 回调参数
- 暴露 `client` 实例

### Task 2: 创建 `use-ws-chat-sessions.ts`
- 实现 `sessions.list` 调用
- 实现会话切换和历史加载
- 实现 LRU 缓存

### Task 3: 创建 `use-ws-chat.ts`
- 实现消息发送
- 实现事件处理 (chat/agent)
- 实现流式文本累积

### Task 4: 改造 `chat-page-client.tsx`
- 集成新 hooks
- 处理连接状态

### Task 5: 改造 `chat-panel.tsx`
- 使用 WebSocket 发送消息
- 处理流式响应

### Task 6: 改造 `chat-session-sidebar.tsx`
- 适配新的会话数据结构

### Task 7: 清理旧代码
- 删除 `chat-storage.ts`
- 删除 `chat/route.ts`
- 删除 `use-chat-sessions.ts`

---

## 10. 风险和注意事项

1. **会话 Key 格式**: Gateway 使用 `agent:main:panel-xxx` 格式，需要兼容
2. **重连处理**: 断线重连后需要重新加载历史
3. **并发消息**: 同一会话多条消息需要正确匹配 runId
4. **token 数显示**: 可选功能，后续添加