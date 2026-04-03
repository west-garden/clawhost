# Multi-Session Chat Design

## Overview

Add multi-session chat support to Portal's chat page (`/agents/[id]/chat`). Users can create multiple independent conversations, each with its own history and model selection.

## Requirements

1. **Multiple Sessions** - User can create, switch, and delete chat sessions
2. **Model Selection** - Each session can independently select a model from configured providers
3. **Persistence** - Chat history persists across page refreshes (localStorage)
4. **UI** - Sidebar showing session list with main chat area

## Data Structure

### Session Storage

Storage key: `clawhost_chat_sessions_{agentId}`

```typescript
interface ChatSession {
  id: string;              // UUID
  title: string;           // Auto-generated from first message or user-edited
  model: string;           // Selected model, e.g., "openai/gpt-4o"
  messages: ChatMessage[]; // Conversation history
  createdAt: number;       // Timestamp
  updatedAt: number;       // Timestamp
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface SessionsStorage {
  sessions: ChatSession[];
  activeSessionId: string | null;
}
```

## Components

### 1. ChatSessionSidebar

- Display list of sessions with titles
- Active session highlighted
- "New Chat" button at top
- Delete button for each session
- Auto-generate title from first user message

### 2. ModelSelector

- Dropdown showing available models
- Format: `{provider}/{model}` (e.g., "openai/gpt-4o", "anthropic/claude-sonnet-4")
- Get model list from agent config API
- Per-session model selection

### 3. ChatArea

- Message list with scroll
- Input area with send button
- Streaming support for responses

## UI Layout

```
┌─────────────────────────────────────────────────────┐
│  Agent Name                          [Model ▼]      │
├────────────┬────────────────────────────────────────┤
│            │                                        │
│  [+ 新对话] │                                        │
│            │       Conversation Messages            │
│  会话 1    │                                        │
│  会话 2    │                                        │
│  会话 3    │                                        │
│            │                                        │
│            ├────────────────────────────────────────┤
│            │  [输入消息...              ] [发送]    │
└────────────┴────────────────────────────────────────┘
```

## API Usage

### Get Available Models

Use existing config API to extract model list:

```
GET /api/v1/agents/{id}/config
```

Response includes `models.providers` with configured providers and their models.

### Send Message

Use existing chat API:

```
POST /api/agents/{id}/chat
Body: { messages: [...], model: "provider/model" }
```

## Implementation Notes

1. **Title Generation** - Use first 30 chars of first user message as session title
2. **Session Limit** - Keep last 20 sessions per agent (configurable)
3. **Message Limit** - Keep last 100 messages per session (configurable)
4. **Responsive** - On mobile, sidebar can collapse to hamburger menu

## Files to Modify

- `portal/src/app/(dashboard)/agents/[id]/chat/page.tsx` - Main chat page
- `portal/src/components/chat-session-sidebar.tsx` - New component
- `portal/src/components/model-selector.tsx` - New component
- `portal/src/hooks/use-chat-sessions.ts` - Session management hook
- `portal/src/lib/chat-storage.ts` - localStorage utilities

## Migration

No migration needed - feature is additive and uses localStorage.