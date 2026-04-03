# Multi-Session Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-session chat support to Portal's chat page with localStorage persistence and per-session model selection.

**Architecture:** Create a session management layer using localStorage, add a sidebar component for session list, and refactor ChatPanel to work with sessions. Models are fetched from existing config API.

**Tech Stack:** React hooks, localStorage, Next.js, TypeScript, existing chat streaming infrastructure

---

## File Structure

**New files:**
- `portal/src/lib/chat-storage.ts` - localStorage utilities for session persistence
- `portal/src/hooks/use-chat-sessions.ts` - Session management hook
- `portal/src/components/chat-session-sidebar.tsx` - Sidebar with session list
- `portal/src/components/model-selector.tsx` - Model dropdown component

**Modified files:**
- `portal/src/app/(dashboard)/agents/[id]/chat/page.tsx` - Add sidebar layout
- `portal/src/components/chat-panel.tsx` - Refactor to accept session props
- `portal/src/app/api/agents/[id]/chat/route.ts` - Add model parameter support
- `portal/src/types/index.ts` - Add session types
- `portal/src/app/globals.css` - Add sidebar styles
- `portal/src/messages/zh.json` - Add Chinese translations
- `portal/src/messages/en.json` - Add English translations

---

### Task 1: Add Session Types

**Files:**
- Modify: `portal/src/types/index.ts`

- [ ] **Step 1: Add session-related types**

Add to end of file:

```typescript
// --- Chat Sessions ---

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  model: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface SessionsStorage {
  sessions: ChatSession[];
  activeSessionId: string | null;
}

export interface ModelInfo {
  id: string;           // e.g., "gpt-4o"
  name: string;         // e.g., "GPT-4o"
  provider: string;     // e.g., "openai"
}

export interface ProviderWithModels {
  name: string;
  baseUrl?: string;
  models?: Array<{ id: string; name?: string }>;
}
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/types/index.ts
git commit -m "feat: add chat session types"
```

---

### Task 2: Create Chat Storage Utilities

**Files:**
- Create: `portal/src/lib/chat-storage.ts`

- [ ] **Step 1: Create localStorage utilities**

```typescript
import type { SessionsStorage, ChatSession, ChatMessage } from "@/types";

const STORAGE_KEY_PREFIX = "clawhost_chat_sessions_";
const MAX_SESSIONS = 20;
const MAX_MESSAGES_PER_SESSION = 100;

function getStorageKey(agentId: string): string {
  return `${STORAGE_KEY_PREFIX}${agentId}`;
}

export function getSessions(agentId: string): SessionsStorage {
  if (typeof window === "undefined") {
    return { sessions: [], activeSessionId: null };
  }

  try {
    const key = getStorageKey(agentId);
    const data = localStorage.getItem(key);
    if (!data) {
      return { sessions: [], activeSessionId: null };
    }
    return JSON.parse(data) as SessionsStorage;
  } catch {
    return { sessions: [], activeSessionId: null };
  }
}

export function saveSessions(agentId: string, storage: SessionsStorage): void {
  if (typeof window === "undefined") return;

  try {
    const key = getStorageKey(agentId);
    // Limit sessions
    const trimmedSessions = storage.sessions.slice(0, MAX_SESSIONS);
    localStorage.setItem(key, JSON.stringify({
      ...storage,
      sessions: trimmedSessions,
    }));
  } catch (e) {
    console.error("Failed to save sessions:", e);
  }
}

export function createSession(model: string): ChatSession {
  return {
    id: crypto.randomUUID(),
    title: "新对话",
    model,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function addMessage(
  session: ChatSession,
  role: "user" | "assistant",
  content: string
): ChatSession {
  const message: ChatMessage = {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: Date.now(),
  };

  const messages = [...session.messages, message].slice(-MAX_MESSAGES_PER_SESSION);

  let title = session.title;
  if (role === "user" && session.title === "新对话" && content.length > 0) {
    title = content.slice(0, 30) + (content.length > 30 ? "..." : "");
  }

  return {
    ...session,
    messages,
    title,
    updatedAt: Date.now(),
  };
}

export function updateSessionModel(session: ChatSession, model: string): ChatSession {
  return {
    ...session,
    model,
    updatedAt: Date.now(),
  };
}

export function deleteSession(storage: SessionsStorage, sessionId: string): SessionsStorage {
  const sessions = storage.sessions.filter((s) => s.id !== sessionId);
  const activeSessionId =
    storage.activeSessionId === sessionId
      ? sessions[0]?.id || null
      : storage.activeSessionId;

  return { sessions, activeSessionId };
}
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/lib/chat-storage.ts
git commit -m "feat: add chat storage utilities for session persistence"
```

---

### Task 3: Create useChatSessions Hook

**Files:**
- Create: `portal/src/hooks/use-chat-sessions.ts`

- [ ] **Step 1: Create session management hook**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import type { ChatSession, SessionsStorage, ModelInfo } from "@/types";
import {
  getSessions,
  saveSessions,
  createSession,
  addMessage,
  updateSessionModel,
  deleteSession,
} from "@/lib/chat-storage";

interface UseChatSessionsOptions {
  agentId: string;
  defaultModel: string;
}

interface UseChatSessionsReturn {
  sessions: ChatSession[];
  activeSession: ChatSession | null;
  isActiveSession: (id: string) => boolean;
  createNewSession: () => void;
  switchSession: (id: string) => void;
  removeSession: (id: string) => void;
  addUserMessage: (content: string) => void;
  addAssistantMessage: (content: string) => void;
  setModel: (model: string) => void;
  clearMessages: () => void;
}

export function useChatSessions({
  agentId,
  defaultModel,
}: UseChatSessionsOptions): UseChatSessionsReturn {
  const [storage, setStorage] = useState<SessionsStorage>({
    sessions: [],
    activeSessionId: null,
  });

  // Load sessions from localStorage on mount
  useEffect(() => {
    const loaded = getSessions(agentId);
    setStorage(loaded);
  }, [agentId]);

  // Save to localStorage on change
  useEffect(() => {
    if (storage.sessions.length > 0 || storage.activeSessionId) {
      saveSessions(agentId, storage);
    }
  }, [agentId, storage]);

  const activeSession = storage.sessions.find(
    (s) => s.id === storage.activeSessionId
  ) || null;

  const isActiveSession = useCallback(
    (id: string) => storage.activeSessionId === id,
    [storage.activeSessionId]
  );

  const updateStorage = useCallback(
    (newStorage: SessionsStorage) => setStorage(newStorage),
    []
  );

  const createNewSession = useCallback(() => {
    const session = createSession(defaultModel);
    const newStorage: SessionsStorage = {
      sessions: [session, ...storage.sessions],
      activeSessionId: session.id,
    };
    updateStorage(newStorage);
  }, [defaultModel, storage.sessions, updateStorage]);

  const switchSession = useCallback(
    (id: string) => {
      updateStorage({ ...storage, activeSessionId: id });
    },
    [storage, updateStorage]
  );

  const removeSession = useCallback(
    (id: string) => {
      const newStorage = deleteSession(storage, id);
      // If no sessions left, create a new one
      if (newStorage.sessions.length === 0) {
        const session = createSession(defaultModel);
        updateStorage({
          sessions: [session],
          activeSessionId: session.id,
        });
      } else {
        updateStorage(newStorage);
      }
    },
    [storage, defaultModel, updateStorage]
  );

  const updateActiveSession = useCallback(
    (updater: (session: ChatSession) => ChatSession) => {
      if (!activeSession) return;
      const updated = updater(activeSession);
      const newSessions = storage.sessions.map((s) =>
        s.id === updated.id ? updated : s
      );
      updateStorage({ ...storage, sessions: newSessions });
    },
    [activeSession, storage, updateStorage]
  );

  const addUserMessage = useCallback(
    (content: string) => {
      updateActiveSession((s) => addMessage(s, "user", content));
    },
    [updateActiveSession]
  );

  const addAssistantMessage = useCallback(
    (content: string) => {
      updateActiveSession((s) => addMessage(s, "assistant", content));
    },
    [updateActiveSession]
  );

  const setModel = useCallback(
    (model: string) => {
      updateActiveSession((s) => updateSessionModel(s, model));
    },
    [updateActiveSession]
  );

  const clearMessages = useCallback(() => {
    if (!activeSession) return;
    updateActiveSession((s) => ({
      ...s,
      messages: [],
      title: "新对话",
      updatedAt: Date.now(),
    }));
  }, [activeSession, updateActiveSession]);

  return {
    sessions: storage.sessions,
    activeSession,
    isActiveSession,
    createNewSession,
    switchSession,
    removeSession,
    addUserMessage,
    addAssistantMessage,
    setModel,
    clearMessages,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/hooks/use-chat-sessions.ts
git commit -m "feat: add useChatSessions hook for session management"
```

---

### Task 4: Create Model Selector Component

**Files:**
- Create: `portal/src/components/model-selector.tsx`

- [ ] **Step 1: Create model selector component**

```typescript
"use client";

import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import type { ProviderWithModels } from "@/types";

interface ModelSelectorProps {
  providers: Record<string, ProviderWithModels>;
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
}

export function ModelSelector({
  providers,
  value,
  onChange,
  disabled,
}: ModelSelectorProps) {
  const t = useTranslations("chat");

  // Build model list from providers
  const modelOptions: { value: string; label: string; provider: string }[] = [];

  Object.entries(providers).forEach(([providerName, provider]) => {
    if (provider.models && provider.models.length > 0) {
      provider.models.forEach((model) => {
        modelOptions.push({
          value: `${providerName}/${model.id}`,
          label: model.name || model.id,
          provider: providerName,
        });
      });
    }
  });

  if (modelOptions.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="appearance-none bg-muted border border-border rounded-lg px-3 py-1.5 pr-8 text-sm text-foreground cursor-pointer hover:bg-accent focus:outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {modelOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/components/model-selector.tsx
git commit -m "feat: add ModelSelector component"
```

---

### Task 5: Create Chat Session Sidebar Component

**Files:**
- Create: `portal/src/components/chat-session-sidebar.tsx`

- [ ] **Step 1: Create sidebar component**

```typescript
"use client";

import { useTranslations } from "next-intl";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import type { ChatSession } from "@/types";

interface ChatSessionSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
}

export function ChatSessionSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
}: ChatSessionSidebarProps) {
  const t = useTranslations("chat");

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
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`chat-sidebar-item ${
              session.id === activeSessionId ? "active" : ""
            }`}
            onClick={() => onSelectSession(session.id)}
          >
            <MessageSquare className="w-4 h-4 flex-shrink-0" />
            <span className="truncate flex-1 text-sm">
              {session.title}
            </span>
            {sessions.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSession(session.id);
                }}
                className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/components/chat-session-sidebar.tsx
git commit -m "feat: add ChatSessionSidebar component"
```

---

### Task 6: Add CSS Styles for Sidebar

**Files:**
- Modify: `portal/src/app/globals.css`

- [ ] **Step 1: Add sidebar styles**

Add to the end of globals.css:

```css
/* Chat Session Sidebar */
.chat-sidebar {
  @apply w-48 flex-shrink-0 border-r border-border bg-muted/30 flex flex-col;
}

.chat-sidebar-new-btn {
  @apply flex items-center gap-2 mx-2 mt-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors;
}

.chat-sidebar-list {
  @apply flex-1 overflow-y-auto p-2 space-y-1;
}

.chat-sidebar-item {
  @apply flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer text-muted-foreground hover:bg-accent hover:text-foreground transition-colors group;
}

.chat-sidebar-item.active {
  @apply bg-accent text-foreground;
}
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/app/globals.css
git commit -m "feat: add chat sidebar CSS styles"
```

---

### Task 7: Add Translations

**Files:**
- Modify: `portal/src/messages/zh.json`
- Modify: `portal/src/messages/en.json`

- [ ] **Step 1: Add Chinese translations**

Find the "chat" section in `zh.json` and add:

```json
"newChat": "新对话",
"selectModel": "选择模型",
"noModel": "请先配置模型"
```

The chat section should look like:

```json
"chat": {
  "warning": "此界面仅为调试入口，不建议日常使用。请配置微信、Telegram 等渠道与 Agent 交互。",
  "inputPlaceholder": "输入消息...",
  "aiDisclaimer": "内容由 AI 生成，仅供参考",
  "notRunning": "Agent 未运行",
  "startToChat": "请先启动 Agent 以开始对话",
  "starting": "Agent 正在启动",
  "startingHint": "请稍候，启动完成后即可开始对话",
  "connecting": "连接中...",
  "connectionError": "连接失败，请重试",
  "send": "发送",
  "newChat": "新对话",
  "selectModel": "选择模型",
  "noModel": "请先配置模型"
}
```

- [ ] **Step 2: Add English translations**

Find the "chat" section in `en.json` and add:

```json
"newChat": "New Chat",
"selectModel": "Select Model",
"noModel": "Please configure a model first"
```

- [ ] **Step 3: Commit**

```bash
git add portal/src/messages/zh.json portal/src/messages/en.json
git commit -m "feat: add chat session translations"
```

---

### Task 8: Update Chat API to Support Model Parameter

**Files:**
- Modify: `portal/src/app/api/agents/[id]/chat/route.ts`

- [ ] **Step 1: Add model parameter to chat request**

Change the body parsing and fetch to include model:

```typescript
const body = await request.json();

// Extract model from body (format: "provider/model")
const model = body.model as string | undefined;

// Proxy to the agent's OpenAI-compatible chat completions endpoint
// Endpoint is host:port format, add http:// scheme
const agentUrl = `http://${connectInfo.endpoint}/v1/chat/completions`;

const requestBody: Record<string, unknown> = {
  ...body,
  stream: true,
};

// If model specified, use it; otherwise let the agent use its default
if (model) {
  requestBody.model = model;
}

const agentRes = await fetch(agentUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${connectInfo.token}`,
  },
  body: JSON.stringify(requestBody),
});
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/app/api/agents/[id]/chat/route.ts
git commit -m "feat: add model parameter support to chat API"
```

---

### Task 9: Refactor ChatPanel for Sessions

**Files:**
- Modify: `portal/src/components/chat-panel.tsx`

- [ ] **Step 1: Update ChatPanel to accept session props**

Replace the entire file with:

```typescript
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAgentStatus } from "@/hooks/use-agent-status";
import { startAgent } from "@/lib/actions";
import { toast } from "sonner";
import type { AgentStatus, ChatSession, ProviderWithModels } from "@/types";
import { Send, AlertTriangle, Play, X, Loader2 } from "lucide-react";
import { ModelSelector } from "./model-selector";

interface ChatPanelProps {
  agentId: string;
  agentName: string;
  initialStatus: AgentStatus;
  activeSession: ChatSession | null;
  onAddUserMessage: (content: string) => void;
  onAddAssistantMessage: (content: string) => void;
  onSetModel: (model: string) => void;
  providers: Record<string, ProviderWithModels>;
}

export function ChatPanel({
  agentId,
  agentName,
  initialStatus,
  activeSession,
  onAddUserMessage,
  onAddAssistantMessage,
  onSetModel,
  providers,
}: ChatPanelProps) {
  const t = useTranslations("chat");
  const ta = useTranslations("agent");
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { status: liveStatus } = useAgentStatus(agentId, true);
  const currentStatus = liveStatus?.status ?? initialStatus;
  const isRunning = currentStatus === "running";
  const isStarting = currentStatus === "starting";

  const initial = (agentName || "?")[0].toUpperCase();

  const messages = activeSession?.messages || [];

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
    if (!text || isStreaming || !isRunning || !activeSession) return;

    onAddUserMessage(text);
    setInput("");
    setIsStreaming(true);

    // Add empty assistant message for streaming (will be updated by onAddAssistantMessage)
    const tempId = "temp-" + Date.now();

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
                  // Update the last message in place
                  onAddAssistantMessage(accumulated);
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
        onAddAssistantMessage(accumulated);
      }
    } catch (err) {
      toast.error(t("connectionError"));
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

  // Starting state
  if (isStarting) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-1">
            {t("starting")}
          </p>
          <p className="text-xs text-muted-foreground">{t("startingHint")}</p>
        </div>
      </div>
    );
  }

  // Not running state
  if (!isRunning) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-muted border border-border flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-1">
            {t("notRunning")}
          </p>
          <p className="text-xs text-muted-foreground mb-4">{t("startToChat")}</p>
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

  // Check if we have models configured
  const hasModels = Object.values(providers).some(
    (p) => p.models && p.models.length > 0
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Messages */}
      <div className="chat-messages">
        {/* Warning banner */}
        {!warningDismissed && (
          <div className="chat-warning">
            <AlertTriangle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-primary leading-relaxed flex-1">
              {t("warning")}
            </p>
            <button
              onClick={() => setWarningDismissed(true)}
              className="text-muted-foreground hover:text-primary flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div
            key={msg.id || i}
            className={`flex gap-2.5 items-start ${
              msg.role === "user" ? "flex-row-reverse" : ""
            }`}
          >
            <div
              className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-semibold flex-shrink-0 mt-0.5 ${
                msg.role === "assistant"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
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
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        {/* Model selector */}
        {hasModels && activeSession && (
          <div className="mb-2">
            <ModelSelector
              providers={providers}
              value={activeSession.model}
              onChange={onSetModel}
              disabled={isStreaming}
            />
          </div>
        )}

        {!hasModels && (
          <p className="text-xs text-yellow-600 dark:text-yellow-500 mb-2">
            {t("noModel")}
          </p>
        )}

        <div className="flex items-end gap-2.5 bg-muted border border-border rounded-xl p-2.5 focus-within:border-primary transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("inputPlaceholder")}
            rows={1}
            className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground resize-none outline-none max-h-32 leading-relaxed"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming || !activeSession}
            className="glass-btn w-8 h-8 flex items-center justify-center flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          {t("aiDisclaimer")}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/components/chat-panel.tsx
git commit -m "refactor: update ChatPanel to work with sessions and model selection"
```

---

### Task 10: Update Chat Page with Sidebar Layout

**Files:**
- Modify: `portal/src/app/(dashboard)/agents/[id]/chat/page.tsx`

- [ ] **Step 1: Refactor chat page to include sidebar and sessions**

```typescript
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { notFound } from "next/navigation";
import { getAgent, ApiError, fetchApi } from "@/lib/api";
import { ChatPanel } from "@/components/chat-panel";
import { ChatSessionSidebar } from "@/components/chat-session-sidebar";
import { useChatSessions } from "@/hooks/use-chat-sessions";
import type { Agent, AgentStatus, ProviderWithModels } from "@/types";
import { Loader2 } from "lucide-react";

export default function AgentChatPage() {
  const params = useParams();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [providers, setProviders] = useState<Record<string, ProviderWithModels>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [agentId]);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      // Load agent info
      const agentData = await getAgent(agentId);
      setAgent(agentData);

      // Load model providers
      const providersResult = await fetchApi<Record<string, ProviderWithModels>>(
        `/api/v1/agents/${agentId}/config/models`
      );
      setProviders(providersResult);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setError("not_found");
      } else {
        setError("failed to load");
      }
    }

    setLoading(false);
  }

  // Get default model from first provider with models
  const defaultModel = (() => {
    for (const [providerName, provider] of Object.entries(providers)) {
      if (provider.models && provider.models.length > 0) {
        return `${providerName}/${provider.models[0].id}`;
      }
    }
    return "";
  })();

  const {
    sessions,
    activeSession,
    isActiveSession,
    createNewSession,
    switchSession,
    removeSession,
    addUserMessage,
    addAssistantMessage,
    setModel,
  } = useChatSessions({
    agentId,
    defaultModel,
  });

  // Create initial session if none exists
  useEffect(() => {
    if (sessions.length === 0 && defaultModel) {
      createNewSession();
    }
  }, [sessions.length, defaultModel, createNewSession]);

  if (error === "not_found") {
    notFound();
  }

  if (loading || !agent) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar */}
      <ChatSessionSidebar
        sessions={sessions}
        activeSessionId={activeSession?.id || null}
        onSelectSession={switchSession}
        onCreateSession={createNewSession}
        onDeleteSession={removeSession}
      />

      {/* Main chat area */}
      <ChatPanel
        agentId={agent.id}
        agentName={agent.name}
        initialStatus={agent.status}
        activeSession={activeSession}
        onAddUserMessage={addUserMessage}
        onAddAssistantMessage={addAssistantMessage}
        onSetModel={setModel}
        providers={providers}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/app/\(dashboard\)/agents/\[id\]/chat/page.tsx
git commit -m "feat: add session sidebar to chat page"
```

---

### Task 11: Fix Streaming Message Update

**Files:**
- Modify: `portal/src/hooks/use-chat-sessions.ts`

- [ ] **Step 1: Add method to update last assistant message**

The current `addAssistantMessage` always adds a new message. We need to update the last message for streaming:

Add a new function `updateLastAssistantMessage`:

```typescript
const updateLastAssistantMessage = useCallback(
  (content: string) => {
    if (!activeSession) return;

    const messages = [...activeSession.messages];
    const lastMessage = messages[messages.length - 1];

    if (lastMessage && lastMessage.role === "assistant") {
      // Update existing assistant message
      messages[messages.length - 1] = {
        ...lastMessage,
        content,
        timestamp: Date.now(),
      };
    } else {
      // Add new assistant message
      messages.push({
        id: crypto.randomUUID(),
        role: "assistant",
        content,
        timestamp: Date.now(),
      });
    }

    const updated = {
      ...activeSession,
      messages,
      updatedAt: Date.now(),
    };

    const newSessions = storage.sessions.map((s) =>
      s.id === updated.id ? updated : s
    );
    updateStorage({ ...storage, sessions: newSessions });
  },
  [activeSession, storage, updateStorage]
);
```

Update the return type and array:

```typescript
return {
  sessions: storage.sessions,
  activeSession,
  isActiveSession,
  createNewSession,
  switchSession,
  removeSession,
  addUserMessage,
  addAssistantMessage,
  updateLastAssistantMessage,
  setModel,
  clearMessages,
};
```

- [ ] **Step 2: Update ChatPanel to use updateLastAssistantMessage**

In `portal/src/components/chat-panel.tsx`, update the props and streaming logic:

Add to props interface:
```typescript
onUpdateLastAssistantMessage: (content: string) => void;
```

Update the streaming handler to call `onUpdateLastAssistantMessage` instead of `onAddAssistantMessage` for incremental updates.

- [ ] **Step 3: Update chat page to pass the new prop**

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: properly update streaming messages without duplicates"
```

---

### Task 12: Final Integration and Testing

**Files:**
- All modified files

- [ ] **Step 1: Run build to verify no TypeScript errors**

```bash
cd portal && pnpm build
```

- [ ] **Step 2: Test in browser**
- Create new session
- Switch between sessions
- Send messages in different sessions
- Select different models
- Delete session
- Refresh page and verify persistence

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete multi-session chat implementation"
```

---

## Summary

This plan implements multi-session chat with:

1. **Session persistence** - localStorage with automatic save/load
2. **Session management** - create, switch, delete sessions
3. **Model selection** - per-session model from configured providers
4. **Clean UI** - sidebar with session list, main chat area

Total estimated implementation: ~2-3 hours