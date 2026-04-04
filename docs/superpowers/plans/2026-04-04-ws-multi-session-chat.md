# WebSocket 多会话聊天实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 ClawHost 的多会话聊天从 localStorage + HTTP SSE 改为完全基于 WebSocket。

**Architecture:** 前端通过 WebSocket 连接 OpenClaw Gateway，使用 `sessions.list`、`chat.history`、`chat.send` 等 JSON-RPC 方法管理会话和消息。

**Tech Stack:** React Hooks, WebSocket, JSON-RPC, OpenClaw Gateway Protocol

---

## File Structure

### New Files
- `portal/src/hooks/use-ws-chat-sessions.ts` - WebSocket 会话管理 hook
- `portal/src/hooks/use-ws-chat.ts` - WebSocket 聊天 hook
- `portal/src/lib/session-meta-storage.ts` - 会话元数据存储（置顶、标题、排序）

### Modified Files
- `portal/src/hooks/use-gateway-connection.ts` - 添加 onEvent 回调
- `portal/src/types/index.ts` - 添加 Gateway 类型
- `portal/src/components/chat-page-client.tsx` - 集成新 hooks
- `portal/src/components/chat-panel.tsx` - 使用 WebSocket 发送消息
- `portal/src/components/chat-session-sidebar.tsx` - 适配 key 字段

### Deleted Files
- `portal/src/lib/chat-storage.ts`
- `portal/src/app/api/agents/[id]/chat/route.ts`
- `portal/src/hooks/use-chat-sessions.ts`

---

## Task 1: 扩展 types/index.ts 添加 Gateway 类型

**Files:**
- Modify: `portal/src/types/index.ts`

- [ ] **Step 1: 添加 Gateway 相关类型定义**

在 `portal/src/types/index.ts` 文件末尾添加：

```typescript
// --- Gateway Types ---

export interface GatewaySession {
  key: string;
  displayName?: string;
  derivedTitle?: string;
  kind?: string;
  channel?: string;
  lastChannel?: string;
  updatedAt?: number;
  totalTokens?: number;
  totalTokensFresh?: boolean;
  spawnedBy?: boolean;
}

export interface GatewaySessionsListResult {
  sessions: GatewaySession[];
}

export interface GatewayMessage {
  role: "user" | "assistant";
  content: string | Array<{ type: "text"; text: string }>;
  timestamp?: number;
  idempotencyKey?: string;
}

export interface GatewayChatHistoryResult {
  messages?: GatewayMessage[];
}

export interface ChatEventPayload {
  state?: "delta" | "final" | "error" | "aborted";
  runId?: string;
  sessionKey?: string;
  message?: GatewayMessage;
  errorMessage?: string;
}

export interface AgentEventPayload {
  runId?: string;
  stream?: "lifecycle" | "tool" | "assistant";
  sessionKey?: string;
  data?: Record<string, unknown>;
}

// --- Session Metadata (localStorage) ---

export interface SessionMeta {
  key: string;
  pinned?: boolean;
  customTitle?: string | null;
  archivedAt?: number | null;
}
```

- [ ] **Step 1a: 更新 ChatSession 接口添加 key 和 pinned**

找到 `ChatSession` 接口定义（约在文件中间），添加 `key` 和 `pinned` 字段：

```typescript
export interface ChatSession {
  key?: string;                   // Gateway session key
  id: string;
  title: string;
  model: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;               // 置顶状态
  unread?: boolean;               // 未读标记
  _isStreaming?: boolean;         // 内部使用：流式消息标记
}
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/types/index.ts
git commit -m "feat: add Gateway types and SessionMeta for WebSocket chat"
```

---

## Task 2: 创建 session-meta-storage.ts（高级功能支持）

**Files:**
- Create: `portal/src/lib/session-meta-storage.ts`

- [ ] **Step 1: 创建会话元数据存储模块**

```typescript
import type { SessionMeta } from "@/types";

const STORAGE_KEY = "clawhost_session_meta";

interface SessionMetaMap {
  [agentId: string]: {
    [sessionKey: string]: SessionMeta;
  };
}

function loadStorage(): SessionMetaMap {
  if (typeof window === "undefined") return {};
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return {};
    return JSON.parse(data) as SessionMetaMap;
  } catch {
    return {};
  }
}

function saveStorage(data: SessionMetaMap): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save session meta:", e);
  }
}

export function getSessionMeta(agentId: string, sessionKey: string): SessionMeta | null {
  const data = loadStorage();
  return data[agentId]?.[sessionKey] ?? null;
}

export function getAllSessionMeta(agentId: string): Record<string, SessionMeta> {
  const data = loadStorage();
  return data[agentId] ?? {};
}

export function setSessionMeta(agentId: string, meta: SessionMeta): void {
  const data = loadStorage();
  if (!data[agentId]) data[agentId] = {};
  data[agentId][meta.key] = meta;
  saveStorage(data);
}

export function updateSessionMeta(
  agentId: string,
  sessionKey: string,
  updates: Partial<SessionMeta>
): SessionMeta | null {
  const data = loadStorage();
  if (!data[agentId]) data[agentId] = {};
  const existing = data[agentId][sessionKey] ?? { key: sessionKey };
  const updated = { ...existing, ...updates, key: sessionKey };
  data[agentId][sessionKey] = updated;
  saveStorage(data);
  return updated;
}

export function togglePin(agentId: string, sessionKey: string): boolean {
  const meta = getSessionMeta(agentId, sessionKey);
  const newPinned = !meta?.pinned;
  updateSessionMeta(agentId, sessionKey, { pinned: newPinned });
  return newPinned;
}

export function setCustomTitle(agentId: string, sessionKey: string, title: string | null): void {
  updateSessionMeta(agentId, sessionKey, { customTitle: title });
}

export function archiveSessionMeta(agentId: string, sessionKey: string): void {
  updateSessionMeta(agentId, sessionKey, { archivedAt: Date.now() });
}

export function unarchiveSessionMeta(agentId: string, sessionKey: string): void {
  updateSessionMeta(agentId, sessionKey, { archivedAt: null });
}

export function getArchivedKeys(agentId: string): Set<string> {
  const meta = getAllSessionMeta(agentId);
  const archived = new Set<string>();
  for (const [key, m] of Object.entries(meta)) {
    if (m.archivedAt != null) archived.add(key);
  }
  return archived;
}

export function getCustomOrder(agentId: string): string[] | null {
  const key = `clawhost_session_order_${agentId}`;
  try {
    const data = localStorage.getItem(key);
    if (!data) return null;
    return JSON.parse(data) as string[];
  } catch {
    return null;
  }
}

export function setCustomOrder(agentId: string, order: string[] | null): void {
  const key = `clawhost_session_order_${agentId}`;
  try {
    if (order) {
      localStorage.setItem(key, JSON.stringify(order));
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/lib/session-meta-storage.ts
git commit -m "feat: add session-meta-storage for pin/archive/title/order"
```

**Files:**
---

## Task 3: 扩展 use-gateway-connection.ts 添加 onEvent 回调

**Files:**
- Modify: `portal/src/hooks/use-gateway-connection.ts`

- [ ] **Step 1: 修改接口定义，添加 onEvent 参数**

将 `UseGatewayConnectionOptions` 接口从：

```typescript
interface UseGatewayConnectionOptions {
  agentId: string;
  enabled: boolean;
}
```

改为：

```typescript
interface UseGatewayConnectionOptions {
  agentId: string;
  enabled: boolean;
  onEvent?: (evt: { type: "event"; event: string; payload?: unknown }) => void;
}
```

- [ ] **Step 2: 修改 hook 参数解构**

将函数签名从：

```typescript
export function useGatewayConnection({
  agentId,
  enabled,
}: UseGatewayConnectionOptions) {
```

改为：

```typescript
export function useGatewayConnection({
  agentId,
  enabled,
  onEvent,
}: UseGatewayConnectionOptions) {
```

- [ ] **Step 3: 添加 onEventRef 保持回调引用**

在 `clientRef` 定义后添加：

```typescript
const clientRef = useRef<GatewayClient | null>(null);
const onEventRef = useRef(onEvent);
onEventRef.current = onEvent;
```

- [ ] **Step 4: 在 GatewayClient 构造时添加 onEvent 回调**

将 GatewayClient 构造从：

```typescript
const client = new GatewayClient({
  url: data.ws_url,
  token: data.token,
  onConnected: (_hello: GatewayHelloOk) => {
    if (cancelled) return;
    setConnectionState("connected");
  },
  onDisconnected: () => {
    if (cancelled) return;
    setConnectionState("connecting");
  },
});
```

改为：

```typescript
const client = new GatewayClient({
  url: data.ws_url,
  token: data.token,
  onConnected: (_hello: GatewayHelloOk) => {
    if (cancelled) return;
    setConnectionState("connected");
  },
  onDisconnected: () => {
    if (cancelled) return;
    setConnectionState("connecting");
  },
  onEvent: (evt) => {
    if (cancelled) return;
    onEventRef.current?.(evt);
  },
});
```

- [ ] **Step 5: Commit**

```bash
git add portal/src/hooks/use-gateway-connection.ts
git commit -m "feat: add onEvent callback to useGatewayConnection"
```

---

## Task 4: 创建 use-ws-chat-sessions.ts（含高级功能）

**Files:**
- Create: `portal/src/hooks/use-ws-chat-sessions.ts`

- [ ] **Step 1: 创建文件并实现 hook**

```typescript
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { GatewayClient } from "@/lib/gateway-client";
import type { ChatSession, ChatMessage, GatewaySessionsListResult, GatewayChatHistoryResult, GatewayMessage, SessionMeta } from "@/types";
import {
  getAllSessionMeta,
  updateSessionMeta,
  getArchivedKeys,
  getCustomOrder,
  setCustomOrder,
} from "@/lib/session-meta-storage";

const FETCH_BATCH = 100;
const MAX_CACHED_SESSIONS = 20;

// Generate a unique session key for new panel-created chats
function generateSessionKey(): string {
  const id = crypto.randomUUID().slice(0, 8);
  return `agent:main:panel-${id}`;
}

// Extract text from Gateway message content
function extractTextContent(content: GatewayMessage["content"]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
  }
  return "";
}

// Parse Gateway messages to ChatMessage format
function parseMessages(messages: GatewayMessage[] | undefined): ChatMessage[] {
  if (!messages) return [];
  return messages.map((msg) => ({
    id: crypto.randomUUID(),
    role: msg.role,
    content: extractTextContent(msg.content),
    timestamp: msg.timestamp ?? Date.now(),
  }));
}

interface SessionCache {
  messages: ChatMessage[];
  lastAccessed: number;
}

interface UseWsChatSessionsOptions {
  agentId: string;
  client: GatewayClient | null;
  connected: boolean;
}

interface UseWsChatSessionsReturn {
  sessions: ChatSession[];
  activeSessionKey: string;
  activeSession: ChatSession | null;
  isLoading: boolean;
  switchSession: (key: string) => Promise<void>;
  createNewSession: () => void;
  archiveSession: (key: string) => void;
  togglePin: (key: string) => void;
  renameSession: (key: string, title: string | null) => void;
  reorderSessions: (fromIndex: number, toIndex: number) => void;
  refreshSessions: () => void;
  getActiveMessages: () => ChatMessage[];
  updateActiveMessages: (messages: ChatMessage[]) => void;
}

export function useWsChatSessions({
  agentId,
  client,
  connected,
}: UseWsChatSessionsOptions): UseWsChatSessionsReturn {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeKey, setActiveKey] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  const cacheRef = useRef<Map<string, SessionCache>>(new Map());
  const activeKeyRef = useRef(activeKey);
  activeKeyRef.current = activeKey;

  // Archived keys from localStorage
  const archivedKeysRef = useRef<Set<string>>(new Set());
  // Session metadata (pinned, customTitle) from localStorage
  const metaMapRef = useRef<Map<string, SessionMeta>>(new Map());
  // Custom order from localStorage
  const customOrderRef = useRef<string[] | null>(null);

  // Load metadata from localStorage on mount
  useEffect(() => {
    const meta = getAllSessionMeta(agentId);
    metaMapRef.current = new Map(Object.entries(meta));
    archivedKeysRef.current = getArchivedKeys(agentId);
    customOrderRef.current = getCustomOrder(agentId);
  }, [agentId]);

  // Fetch sessions list from Gateway
  const fetchSessionsList = useCallback(async () => {
    if (!client) return;

    try {
      const result = await client.request<GatewaySessionsListResult>("sessions.list", {
        includeDerivedTitles: true,
      });

      if (!result?.sessions) return;

      const archived = archivedKeysRef.current;
      const meta = metaMapRef.current;

      // Filter out spawnedBy sessions and archived sessions
      const filtered = result.sessions.filter(
        (s) => !s.spawnedBy && !archived.has(s.key)
      );

      const chatSessions: ChatSession[] = filtered.map((s) => {
        const m = meta.get(s.key);
        return {
          key: s.key,
          id: s.key,
          title: m?.customTitle || s.derivedTitle || s.displayName || "新对话",
          messages: [],
          createdAt: s.updatedAt ?? Date.now(),
          updatedAt: s.updatedAt ?? Date.now(),
          pinned: m?.pinned,
        };
      });

      // Apply custom order or default sort
      const customOrder = customOrderRef.current;
      if (customOrder && customOrder.length > 0) {
        const orderMap = new Map(customOrder.map((key, i) => [key, i]));
        chatSessions.sort((a, b) => {
          const pa = a.pinned ? 1 : 0;
          const pb = b.pinned ? 1 : 0;
          if (pa !== pb) return pb - pa;
          const oa = orderMap.get(a.key);
          const ob = orderMap.get(b.key);
          if (oa !== undefined && ob !== undefined) return oa - ob;
          if (oa !== undefined) return -1;
          if (ob !== undefined) return 1;
          return b.updatedAt - a.updatedAt;
        });
      } else {
        chatSessions.sort((a, b) => {
          const pa = a.pinned ? 1 : 0;
          const pb = b.pinned ? 1 : 0;
          if (pa !== pb) return pb - pa;
          return b.updatedAt - a.updatedAt;
        });
      }

      setSessions(chatSessions);

      // Set active session to first one if not set
      if (!activeKeyRef.current && chatSessions.length > 0) {
        setActiveKey(chatSessions[0].key);
      }
    } catch (err) {
      console.error("[useWsChatSessions] Failed to fetch sessions:", err);
    }
  }, [client]);

  // Load history for a session
  const loadHistory = useCallback(async (sessionKey: string): Promise<ChatMessage[]> => {
    if (!client) return [];

    try {
      const result = await client.request<GatewayChatHistoryResult>("chat.history", {
        sessionKey,
        limit: FETCH_BATCH,
      });

      return parseMessages(result?.messages);
    } catch (err) {
      console.error("[useWsChatSessions] Failed to load history:", err);
      return [];
    }
  }, [client]);

  // Fetch sessions on connect
  useEffect(() => {
    if (!connected || !client) {
      setIsLoading(true);
      return;
    }

    setIsLoading(true);
    fetchSessionsList().then(() => {
      setIsLoading(false);
    });
  }, [connected, client, fetchSessionsList]);

  // Switch to a different session
  const switchSession = useCallback(async (key: string) => {
    if (key === activeKeyRef.current) return;

    setActiveKey(key);

    // Check cache first
    const cached = cacheRef.current.get(key);
    if (cached) {
      cached.lastAccessed = Date.now();
      return;
    }

    // Load history from Gateway
    const messages = await loadHistory(key);

    // LRU eviction
    if (cacheRef.current.size >= MAX_CACHED_SESSIONS) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [k, v] of cacheRef.current) {
        if (k === key) continue;
        if (v.lastAccessed < oldestTime) {
          oldestTime = v.lastAccessed;
          oldestKey = k;
        }
      }
      if (oldestKey) cacheRef.current.delete(oldestKey);
    }

    cacheRef.current.set(key, {
      messages,
      lastAccessed: Date.now(),
    });
  }, [loadHistory]);

  // Create a new session (optimistic)
  const createNewSession = useCallback(() => {
    const newKey = generateSessionKey();
    const newSession: ChatSession = {
      key: newKey,
      id: newKey,
      title: "新对话",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setSessions((prev) => [newSession, ...prev]);
    setActiveKey(newKey);

    // Initialize empty cache
    cacheRef.current.set(newKey, {
      messages: [],
      lastAccessed: Date.now(),
    });

    // Update custom order
    if (customOrderRef.current) {
      customOrderRef.current = [newKey, ...customOrderRef.current];
      setCustomOrder(agentId, customOrderRef.current);
    }
  }, [agentId]);

  // Archive a session
  const archiveSession = useCallback((key: string) => {
    // Optimistic: add to archived set
    archivedKeysRef.current = new Set([...archivedKeysRef.current, key]);

    // Persist to localStorage
    updateSessionMeta(agentId, key, { archivedAt: Date.now() });

    // Remove from sessions list
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.key !== key);
      if (filtered.length === 0) return prev;
      return filtered;
    });

    // Remove from custom order
    if (customOrderRef.current) {
      customOrderRef.current = customOrderRef.current.filter((k) => k !== key);
      setCustomOrder(agentId, customOrderRef.current);
    }

    // Remove from cache
    cacheRef.current.delete(key);

    // Switch to first session if archiving active
    if (key === activeKeyRef.current) {
      setSessions((prev) => {
        if (prev.length > 0) {
          setActiveKey(prev[0].key);
        }
        return prev;
      });
    }
  }, [agentId]);

  // Toggle pin
  const togglePin = useCallback((key: string) => {
    const meta = metaMapRef.current.get(key);
    const newPinned = !meta?.pinned;

    // Optimistic update
    const updated = { ...meta, key, pinned: newPinned } as SessionMeta;
    metaMapRef.current.set(key, updated);

    // Persist to localStorage
    updateSessionMeta(agentId, key, { pinned: newPinned });

    // Update sessions and re-sort
    setSessions((prev) => {
      const next = prev.map((s) =>
        s.key === key ? { ...s, pinned: newPinned } : s
      );
      // Re-sort only if no custom order
      if (!customOrderRef.current) {
        next.sort((a, b) => {
          const pa = a.pinned ? 1 : 0;
          const pb = b.pinned ? 1 : 0;
          if (pa !== pb) return pb - pa;
          return b.updatedAt - a.updatedAt;
        });
      }
      return next;
    });
  }, [agentId]);

  // Rename session
  const renameSession = useCallback((key: string, title: string | null) => {
    // Optimistic update
    const meta = metaMapRef.current.get(key);
    const updated = { ...meta, key, customTitle: title } as SessionMeta;
    metaMapRef.current.set(key, updated);

    // Persist to localStorage
    updateSessionMeta(agentId, key, { customTitle: title });

    // Update sessions
    setSessions((prev) =>
      prev.map((s) =>
        s.key === key ? { ...s, title: title || s.title } : s
      )
    );
  }, [agentId]);

  // Reorder sessions
  const reorderSessions = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    setSessions((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);

      // Save new order
      customOrderRef.current = next.map((s) => s.key);
      setCustomOrder(agentId, customOrderRef.current);

      return next;
    });
  }, [agentId]);

  // Refresh sessions list
  const refreshSessions = useCallback(() => {
    if (connected && client) {
      fetchSessionsList();
    }
  }, [connected, client, fetchSessionsList]);

  // Get active session messages from cache
  const getActiveMessages = useCallback((): ChatMessage[] => {
    const cached = cacheRef.current.get(activeKeyRef.current);
    return cached?.messages ?? [];
  }, []);

  // Update active session messages in cache
  const updateActiveMessages = useCallback((messages: ChatMessage[]) => {
    cacheRef.current.set(activeKeyRef.current, {
      messages,
      lastAccessed: Date.now(),
    });
  }, []);

  // Get active session
  const activeSession = sessions.find((s) => s.key === activeKey) ?? null;

  return {
    sessions,
    activeSessionKey: activeKey,
    activeSession,
    isLoading,
    switchSession,
    createNewSession,
    archiveSession,
    togglePin,
    renameSession,
    reorderSessions,
    refreshSessions,
    getActiveMessages,
    updateActiveMessages,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/hooks/use-ws-chat-sessions.ts
git commit -m "feat: add useWsChatSessions hook with pin/rename/archive/reorder"
```

---

## Task 5: 创建 use-ws-chat.ts

**Files:**
- Create: `portal/src/hooks/use-ws-chat.ts`

- [ ] **Step 1: 创建文件并实现 hook**

```typescript
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { GatewayClient, GatewayEvent } from "@/lib/gateway-client";
import type { ChatMessage, ChatEventPayload, AgentEventPayload } from "@/types";

interface UseWsChatOptions {
  client: GatewayClient | null;
  connected: boolean;
  sessionKey: string;
  getMessages: () => ChatMessage[];
  updateMessages: (messages: ChatMessage[]) => void;
}

interface UseWsChatReturn {
  isStreaming: boolean;
  sendMessage: (text: string) => void;
  abortGeneration: () => void;
}

export function useWsChat({
  client,
  connected,
  sessionKey,
  getMessages,
  updateMessages,
}: UseWsChatOptions): UseWsChatReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const streamingTextRef = useRef("");
  const runIdRef = useRef<string | null>(null);

  const sessionKeyRef = useRef(sessionKey);
  sessionKeyRef.current = sessionKey;

  // Handle Gateway events
  const handleEvent = useCallback((evt: GatewayEvent) => {
    if (evt.event === "chat") {
      const payload = evt.payload as ChatEventPayload | undefined;
      if (!payload) return;

      // Only process events for our session
      if (payload.sessionKey && payload.sessionKey !== sessionKeyRef.current) {
        return;
      }

      const chatRunId = payload.runId;

      switch (payload.state) {
        case "delta": {
          // Accumulate streaming text
          const text = payload.message?.content;
          if (typeof text === "string") {
            streamingTextRef.current = text;
          } else if (Array.isArray(text)) {
            streamingTextRef.current = text
              .filter((b) => b.type === "text")
              .map((b) => b.text)
              .join("");
          }

          // Update messages with streaming text
          const messages = getMessages();
          const lastMsg = messages[messages.length - 1];

          if (lastMsg?.role === "assistant" && lastMsg._isStreaming) {
            // Update existing streaming message
            const updated = [...messages];
            updated[updated.length - 1] = {
              ...lastMsg,
              content: streamingTextRef.current,
            };
            updateMessages(updated);
          } else {
            // Add new streaming message
            updateMessages([
              ...messages,
              {
                id: crypto.randomUUID(),
                role: "assistant" as const,
                content: streamingTextRef.current,
                timestamp: Date.now(),
                _isStreaming: true,
              },
            ]);
          }
          break;
        }

        case "final": {
          const text = payload.message?.content;
          let finalText = "";
          if (typeof text === "string") {
            finalText = text;
          } else if (Array.isArray(text)) {
            finalText = text
              .filter((b) => b.type === "text")
              .map((b) => b.text)
              .join("");
          }

          // Replace streaming message with final
          const messages = getMessages();
          const lastMsg = messages[messages.length - 1];

          if (lastMsg?._isStreaming) {
            const updated = [...messages];
            updated[updated.length - 1] = {
              ...lastMsg,
              content: finalText,
              _isStreaming: undefined,
            };
            updateMessages(updated);
          } else {
            // Add final message if no streaming message
            updateMessages([
              ...messages,
              {
                id: crypto.randomUUID(),
                role: "assistant" as const,
                content: finalText,
                timestamp: Date.now(),
              },
            ]);
          }

          streamingTextRef.current = "";
          runIdRef.current = null;
          setIsStreaming(false);
          break;
        }

        case "error": {
          // Replace streaming with error message
          const messages = getMessages();
          const lastMsg = messages[messages.length - 1];
          const errMsg = payload.errorMessage || "生成失败";

          if (lastMsg?._isStreaming) {
            const updated = [...messages];
            updated[updated.length - 1] = {
              ...lastMsg,
              content: `⚠ ${errMsg}`,
              _isStreaming: undefined,
            };
            updateMessages(updated);
          }

          streamingTextRef.current = "";
          runIdRef.current = null;
          setIsStreaming(false);
          break;
        }

        case "aborted": {
          // Keep partial text as final message
          const messages = getMessages();
          const lastMsg = messages[messages.length - 1];

          if (lastMsg?._isStreaming) {
            const updated = [...messages];
            updated[updated.length - 1] = {
              ...lastMsg,
              _isStreaming: undefined,
            };
            updateMessages(updated);
          }

          streamingTextRef.current = "";
          runIdRef.current = null;
          setIsStreaming(false);
          break;
        }
      }
    }
  }, [getMessages, updateMessages]);

  // Register event handler
  useEffect(() => {
    // This effect is handled by the parent component passing onEvent to useGatewayConnection
  }, []);

  // Send message
  const sendMessage = useCallback((text: string) => {
    if (!client || !connected || !sessionKey) return;

    const idempotencyKey = crypto.randomUUID();
    runIdRef.current = idempotencyKey;
    streamingTextRef.current = "";

    // Add user message
    const messages = getMessages();
    const updatedMessages = [
      ...messages,
      {
        id: crypto.randomUUID(),
        role: "user" as const,
        content: text,
        timestamp: Date.now(),
      },
    ];
    updateMessages(updatedMessages);

    setIsStreaming(true);

    // Send to Gateway
    client.request("chat.send", {
      sessionKey,
      message: text,
      idempotencyKey,
    }).catch((err) => {
      console.error("[useWsChat] Send failed:", err);
      setIsStreaming(false);

      // Add error message
      const currentMessages = getMessages();
      updateMessages([
        ...currentMessages,
        {
          id: crypto.randomUUID(),
          role: "assistant" as const,
          content: `⚠ 发送失败: ${err}`,
          timestamp: Date.now(),
        },
      ]);
    });
  }, [client, connected, sessionKey, getMessages, updateMessages]);

  // Abort generation
  const abortGeneration = useCallback(() => {
    if (!client || !connected || !runIdRef.current || !sessionKey) return;

    client.request("chat.abort", {
      sessionKey,
      runId: runIdRef.current,
    }).catch(() => {});
  }, [client, connected, sessionKey]);

  return {
    isStreaming,
    sendMessage,
    abortGeneration,
    handleEvent,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/hooks/use-ws-chat.ts
git commit -m "feat: add useWsChat hook for WebSocket chat"
```

---

## Task 6: 改造 chat-page-client.tsx

**Files:**
- Modify: `portal/src/components/chat-page-client.tsx`

- [ ] **Step 1: 更新 imports**

将文件开头改为：

```typescript
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChatPanel } from "@/components/chat-panel";
import { ChatSessionSidebar } from "@/components/chat-session-sidebar";
import { useGatewayConnection } from "@/hooks/use-gateway-connection";
import { useWsChatSessions } from "@/hooks/use-ws-chat-sessions";
import { useWsChat } from "@/hooks/use-ws-chat";
import type { AgentStatus, ProviderWithModels, ChatMessage, GatewayEvent } from "@/types";
```

- [ ] **Step 2: 修改组件主体**

将整个组件函数替换为：

```typescript
export function ChatPageClient({
  agentId,
  agentName,
  initialStatus,
  providers,
}: ChatPageClientProps) {
  // Get default model from first provider with models
  const defaultModel = (() => {
    for (const [providerName, provider] of Object.entries(providers)) {
      if (provider.models && provider.models.length > 0) {
        return `${providerName}/${provider.models[0].id}`;
      }
    }
    return "default";
  })();

  // Agent status
  const [currentStatus, setCurrentStatus] = useState(initialStatus);

  // Gateway connection with event handling
  const handleGatewayEvent = useCallback((evt: GatewayEvent) => {
    wsChatRef.current?.handleEvent(evt);
  }, []);

  const { connectionState, client } = useGatewayConnection({
    agentId,
    enabled: currentStatus === "running",
    onEvent: handleGatewayEvent,
  });

  const isConnected = connectionState === "connected";
  const isConnecting = connectionState === "connecting";

  // Session management
  const {
    sessions,
    activeSessionKey,
    activeSession,
    isLoading: sessionsLoading,
    switchSession,
    createNewSession,
    archiveSession,
    togglePin,
    renameSession,
    reorderSessions,
    refreshSessions,
    getActiveMessages,
    updateActiveMessages,
  } = useWsChatSessions({
    agentId,
    client,
    connected: isConnected,
  });

  // Ref for wsChat to call handleEvent
  const wsChatRef = useRef<ReturnType<typeof useWsChat> | null>(null);

  // Chat management
  const wsChat = useWsChat({
    client,
    connected: isConnected,
    sessionKey: activeSessionKey,
    getMessages: getActiveMessages,
    updateMessages: updateActiveMessages,
  });
  wsChatRef.current = wsChat;

  const messages = getActiveMessages();
  const isStreaming = wsChat.isStreaming;

  // Update session messages in sidebar when they change
  const sessionsWithMessages = sessions.map((s) => ({
    ...s,
    messages: s.key === activeSessionKey ? messages : [],
  }));

  // Create initial session if none exists
  useEffect(() => {
    if (!sessionsLoading && sessions.length === 0 && isConnected) {
      createNewSession();
    }
  }, [sessionsLoading, sessions.length, isConnected, createNewSession]);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar */}
      <ChatSessionSidebar
        sessions={sessionsWithMessages}
        activeSessionId={activeSessionKey}
        onSelectSession={switchSession}
        onCreateSession={createNewSession}
        onDeleteSession={archiveSession}
        onTogglePin={togglePin}
        onRename={renameSession}
        onReorder={reorderSessions}
      />

      {/* Main chat area */}
      <ChatPanel
        agentId={agentId}
        agentName={agentName}
        initialStatus={currentStatus}
        activeSession={activeSession ? { ...activeSession, messages } : null}
        onAddUserMessage={() => {}} // Handled by useWsChat
        onUpdateLastAssistantMessage={() => {}} // Handled by useWsChat
        onSetModel={() => {}} // TODO: implement model switching
        providers={providers}
        // New props for WebSocket mode
        isConnected={isConnected}
        isConnecting={isConnecting}
        isStreaming={isStreaming}
        sendMessage={wsChat.sendMessage}
        abortGeneration={wsChat.abortGeneration}
      />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add portal/src/components/chat-page-client.tsx
git commit -m "feat: integrate WebSocket hooks in chat-page-client"
```

---

## Task 7: 改造 chat-panel.tsx

**Files:**
- Modify: `portal/src/components/chat-panel.tsx`

- [ ] **Step 1: 更新接口定义**

将 `ChatPanelProps` 接口从：

```typescript
interface ChatPanelProps {
  agentId: string;
  agentName: string;
  initialStatus: AgentStatus;
  activeSession: ChatSession | null;
  onAddUserMessage: (content: string, sessionId?: string) => void;
  onUpdateLastAssistantMessage: (content: string, sessionId?: string) => void;
  onSetModel: (model: string) => void;
  providers: Record<string, ProviderWithModels>;
}
```

改为：

```typescript
interface ChatPanelProps {
  agentId: string;
  agentName: string;
  initialStatus: AgentStatus;
  activeSession: ChatSession | null;
  onAddUserMessage: (content: string, sessionId?: string) => void;
  onUpdateLastAssistantMessage: (content: string, sessionId?: string) => void;
  onSetModel: (model: string) => void;
  providers: Record<string, ProviderWithModels>;
  // WebSocket mode props
  isConnected?: boolean;
  isConnecting?: boolean;
  isStreaming?: boolean;
  sendMessage?: (text: string) => void;
  abortGeneration?: () => void;
}
```

- [ ] **Step 2: 更新组件参数解构**

将函数签名从：

```typescript
export function ChatPanel({
  agentId,
  agentName,
  initialStatus,
  activeSession,
  onAddUserMessage,
  onUpdateLastAssistantMessage,
  onSetModel,
  providers,
}: ChatPanelProps) {
```

改为：

```typescript
export function ChatPanel({
  agentId,
  agentName,
  initialStatus,
  activeSession,
  onAddUserMessage,
  onUpdateLastAssistantMessage,
  onSetModel,
  providers,
  // WebSocket mode
  isConnected: wsConnected,
  isConnecting: wsConnecting,
  isStreaming: wsStreaming,
  sendMessage: wsSendMessage,
  abortGeneration: wsAbortGeneration,
}: ChatPanelProps) {
```

- [ ] **Step 3: 修改 isStreaming 状态逻辑**

将：

```typescript
const [isStreaming, setIsStreaming] = useState(false);
```

改为：

```typescript
const [isStreaming, setIsStreaming] = useState(false);
// Use WebSocket streaming state if available
const effectiveStreaming = wsStreaming ?? isStreaming;
```

- [ ] **Step 4: 修改 handleSend 函数**

将 `handleSend` 函数替换为：

```typescript
async function handleSend() {
  const text = input.trim();
  if (!text || effectiveStreaming || !isRunning || !activeSession) return;

  // WebSocket mode
  if (wsSendMessage && wsConnected) {
    setInput("");
    wsSendMessage(text);
    return;
  }

  // HTTP fallback (for backward compatibility)
  // Check gateway connection
  if (!isConnected) {
    toast.error(t("gatewayDisconnected"));
    return;
  }

  // Capture session ID at send time to ensure responses go to correct session
  const sessionId = activeSession.id;

  onAddUserMessage(text, sessionId);
  setInput("");
  setIsStreaming(true);

  // Add placeholder for streaming response
  onUpdateLastAssistantMessage("", sessionId);

  try {
    const res = await fetch(`/api/agents/${agentId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [...messages, { role: "user", content: text }].map((m) => ({
          role: m.role,
          content: m.content,
        })),
        model: activeSession.model,
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
                onUpdateLastAssistantMessage(accumulated, sessionId);
              }
            } catch {
              // Skip non-JSON lines
            }
          }
        }
      }
    }

    // Final update with complete message
    if (accumulated) {
      onUpdateLastAssistantMessage(accumulated, sessionId);
    }
  } catch (err) {
    toast.error(t("connectionError"));
  } finally {
    setIsStreaming(false);
  }
}
```

- [ ] **Step 5: 更新连接状态显示**

在连接状态指示器部分，使用 WebSocket 状态：

```typescript
{/* Connection status indicator */}
{isRunning && (
  <div className="flex items-center gap-2 mb-2 text-xs">
    <span
      className={`inline-flex items-center gap-1.5 ${
        wsConnected
          ? "text-emerald-600 dark:text-emerald-400"
          : wsConnecting
            ? "text-yellow-600 dark:text-yellow-400"
            : "text-red-600 dark:text-red-400"
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          wsConnected
            ? "bg-emerald-500"
            : wsConnecting
              ? "bg-yellow-500 animate-pulse"
              : "bg-red-500"
        }`}
      />
      {wsConnected ? (
        <Wifi className="w-3.5 h-3.5" />
      ) : (
        <WifiOff className="w-3.5 h-3.5" />
      )}
      <span>
        {wsConnected
          ? t("connected")
          : wsConnecting
            ? t("connecting")
            : t("disconnected")}
      </span>
    </span>
  </div>
)}
```

- [ ] **Step 6: 更新发送按钮禁用逻辑**

将发送按钮的 `disabled` 属性从：

```typescript
disabled={!input.trim() || isStreaming || !activeSession}
```

改为：

```typescript
disabled={!input.trim() || effectiveStreaming || !activeSession || (wsSendMessage && !wsConnected)}
```

- [ ] **Step 7: Commit**

```bash
git add portal/src/components/chat-panel.tsx
git commit -m "feat: add WebSocket mode support to chat-panel"
```

---

## Task 8: 改造 chat-session-sidebar.tsx（支持高级功能）

**Files:**
- Modify: `portal/src/components/chat-session-sidebar.tsx`

- [ ] **Step 1: 更新接口和组件以支持置顶、重命名、拖拽**

将整个文件替换为：

```typescript
"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Plus, MessageSquare, Trash2, Pin, Edit2, Check, X } from "lucide-react";
import type { ChatSession } from "@/types";

interface ChatSessionSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onRename?: (id: string, title: string | null) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
}

export function ChatSessionSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onTogglePin,
  onRename,
  onReorder,
}: ChatSessionSidebarProps) {
  const t = useTranslations("chat");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleStartEdit = (session: ChatSession) => {
    setEditingId(session.key || session.id);
    setEditingTitle(session.title);
  };

  const handleSaveEdit = () => {
    if (editingId && onRename && editingTitle.trim()) {
      onRename(editingId, editingTitle.trim());
    }
    setEditingId(null);
    setEditingTitle("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
  };

  const handleDrop = (index: number) => {
    if (draggedIndex !== null && draggedIndex !== index && onReorder) {
      onReorder(draggedIndex, index);
    }
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="chat-sidebar">
      {/* New chat button */}
      <button
        onClick={onCreateSession}
        className="chat-sidebar-new-btn"
      >
        <Plus className="w-4 h-4" />
        <span>{t("newChat")}</span>
      </button>

      {/* Session list */}
      <div className="chat-sidebar-list">
        {sessions.map((session, index) => {
          const sessionKey = session.key || session.id;
          const isActive = sessionKey === activeSessionId;
          const isEditing = sessionKey === editingId;
          const isPinned = session.pinned;

          return (
            <div
              key={sessionKey}
              draggable={!!onReorder}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              className={`chat-sidebar-item group ${
                isActive ? "active" : ""
              } ${isPinned ? "pinned" : ""} ${
                draggedIndex === index ? "dragging" : ""
              }`}
              onClick={() => !isEditing && onSelectSession(sessionKey)}
            >
              {isPinned && (
                <Pin className="w-3 h-3 text-primary flex-shrink-0" />
              )}
              <MessageSquare className="w-4 h-4 flex-shrink-0" />

              {isEditing ? (
                <div className="flex-1 flex items-center gap-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit();
                      if (e.key === "Escape") handleCancelEdit();
                    }}
                    className="flex-1 text-sm bg-background border border-border rounded px-1 py-0.5"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveEdit();
                    }}
                    className="p-0.5 hover:text-emerald-500"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancelEdit();
                    }}
                    className="p-0.5 hover:text-red-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="truncate flex-1 text-sm">
                    {session.title}
                  </span>

                  {/* Action buttons */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onTogglePin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePin(sessionKey);
                        }}
                        className={`p-0.5 hover:text-primary ${
                          isPinned ? "text-primary" : ""
                        }`}
                        title={isPinned ? "取消置顶" : "置顶"}
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {onRename && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(session);
                        }}
                        className="p-0.5 hover:text-primary"
                        title="重命名"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {sessions.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(sessionKey);
                        }}
                        className="p-0.5 hover:text-red-500"
                        title="删除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/components/chat-session-sidebar.tsx
git commit -m "feat: update chat-session-sidebar to support key field"
```

---

## Task 9: 清理旧代码

**Files:**
- Delete: `portal/src/lib/chat-storage.ts`
- Delete: `portal/src/app/api/agents/[id]/chat/route.ts`
- Delete: `portal/src/hooks/use-chat-sessions.ts`

- [ ] **Step 1: 删除不再需要的文件**

```bash
rm portal/src/lib/chat-storage.ts
rm "portal/src/app/api/agents/[id]/chat/route.ts"
rm portal/src/hooks/use-chat-sessions.ts
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove deprecated localStorage and HTTP chat code"
```

---

## Task 10: 最终验证和提交

- [ ] **Step 1: 检查 TypeScript 编译**

```bash
cd portal && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 2: 测试构建**

```bash
cd portal && npm run build
```

Expected: Build succeeds

- [ ] **Step 3: 最终提交**

```bash
git add -A
git commit -m "feat: complete WebSocket multi-session chat migration"
```