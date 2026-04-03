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
// portal/src/types/index.ts

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface ChatSession {
  id: string;
  title: string;
  model: string;           // "provider/model" format, e.g., "openai/gpt-4o"
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

interface SessionsStorage {
  sessions: ChatSession[];
  activeSessionId: string | null;
}

interface ProviderWithModels {
  name: string;
  baseUrl?: string;
  models?: Array<{ id: string; name?: string }>;
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Server Component                             │
│  portal/src/app/(dashboard)/agents/[id]/chat/page.tsx           │
│  - Fetches agent data and providers via server actions          │
│  - Passes data to ChatPageClient                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Client Component                            │
│  portal/src/components/chat-page-client.tsx                     │
│  - useChatSessions hook for state management                    │
│  - Renders ChatSessionSidebar + ChatPanel                       │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────────┐
│   ChatSessionSidebar    │     │          ChatPanel              │
│   - Session list        │     │   - Message display             │
│   - New chat button     │     │   - ModelSelector               │
│   - Delete session      │     │   - Input area                  │
└─────────────────────────┘     └─────────────────────────────────┘
```

## Components

### 1. ChatSessionSidebar (`portal/src/components/chat-session-sidebar.tsx`)

- Display list of sessions with titles
- Active session highlighted
- "New Chat" button at top
- Delete button for each session (shown on hover)
- Auto-generate title from first user message (first 30 chars)

### 2. ModelSelector (`portal/src/components/model-selector.tsx`)

- Dropdown showing available models from all providers
- Format: `{provider}/{model}` (e.g., "openai/gpt-4o")
- Get model list from providers prop (fetched via `listModelProviders`)
- Per-session model selection

### 3. ChatPanel (`portal/src/components/chat-panel.tsx`)

- Message list with scroll
- ModelSelector above input area
- Input area with send button
- Streaming support for responses
- Agent status handling (starting, not running states)

### 4. ChatPageClient (`portal/src/components/chat-page-client.tsx`)

- Client component that orchestrates session state
- Uses useChatSessions hook
- Creates initial session if none exists

## Hooks

### useChatSessions (`portal/src/hooks/use-chat-sessions.ts`)

Session management hook with:

```typescript
interface UseChatSessionsReturn {
  sessions: ChatSession[];           // All sessions for this agent
  activeSession: ChatSession | null; // Currently active session
  isActiveSession: (id: string) => boolean;
  createNewSession: () => void;      // Create new session, make it active
  switchSession: (id: string) => void;
  removeSession: (id: string) => void;
  addUserMessage: (content: string) => void;
  addAssistantMessage: (content: string) => void;
  updateLastAssistantMessage: (content: string) => void;  // For streaming
  setModel: (model: string) => void;
  clearMessages: () => void;
}
```

## Utilities

### Chat Storage (`portal/src/lib/chat-storage.ts`)

localStorage utilities:

- `getSessions(agentId)` - Load sessions from localStorage
- `saveSessions(agentId, storage)` - Persist sessions to localStorage
- `createSession(model)` - Create new session with UUID
- `addMessage(session, role, content)` - Add message to session
- `updateSessionModel(session, model)` - Update model selection
- `deleteSession(storage, sessionId)` - Remove session from storage

**Limits:**
- `MAX_SESSIONS = 20` - Keep last 20 sessions per agent
- `MAX_MESSAGES_PER_SESSION = 100` - Keep last 100 messages per session

## UI Layout

```
┌─────────────────────────────────────────────────────┐
│                                        [Model ▼]    │
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

**CSS Classes** (defined in `globals.css`):
- `.chat-sidebar` - Fixed width (12rem), flex column
- `.chat-sidebar-new-btn` - Primary button style
- `.chat-sidebar-item` - Session item with hover state
- `.chat-sidebar-item.active` - Active session highlight

## API Usage

### Get Available Models

Uses existing server action from `portal/src/lib/actions.ts`:

```typescript
const result = await listModelProviders(agentId);
// Returns: { providers: Record<string, ProviderWithModels> }
```

Which calls:
```
GET /api/v1/agents/{id}/config/models
```

### Send Message

Portal proxy endpoint (`portal/src/app/api/agents/[id]/chat/route.ts`):

```
POST /api/agents/{id}/chat
Body: { messages: [...], model: "provider/model" }
```

The model parameter is optional - if provided, it overrides the agent's default model.

## Implementation Notes

1. **Title Generation** - First 30 chars of first user message, appended with "..." if longer
2. **Session Limit** - Keep last 20 sessions per agent
3. **Message Limit** - Keep last 100 messages per session
4. **Default Model** - First model from first provider with models configured
5. **Initial Session** - Auto-created when page loads with no sessions
6. **Streaming** - Uses `updateLastAssistantMessage` for incremental updates

## Files Created

| File | Purpose |
|------|---------|
| `portal/src/lib/chat-storage.ts` | localStorage utilities for session persistence |
| `portal/src/hooks/use-chat-sessions.ts` | React hook for session state management |
| `portal/src/components/model-selector.tsx` | Model dropdown component |
| `portal/src/components/chat-session-sidebar.tsx` | Sidebar with session list |
| `portal/src/components/chat-page-client.tsx` | Client component orchestrating sessions |

## Files Modified

| File | Changes |
|------|---------|
| `portal/src/app/(dashboard)/agents/[id]/chat/page.tsx` | Convert to server component, pass data to client |
| `portal/src/components/chat-panel.tsx` | Refactor to accept session props |
| `portal/src/app/api/agents/[id]/chat/route.ts` | Add model parameter support |
| `portal/src/types/index.ts` | Add session-related types |
| `portal/src/app/globals.css` | Add sidebar CSS styles |
| `portal/src/messages/zh.json` | Add Chinese translations |
| `portal/src/messages/en.json` | Add English translations |

## Future Enhancements

1. **Responsive Design** - Sidebar collapse for mobile views
2. **Session Search** - Filter sessions by title
3. **Session Rename** - Allow user to edit session titles
4. **Export/Import** - Export chat history as JSON/Markdown
5. **Model Validation** - Handle case where saved model no longer exists in providers

## Migration

No migration needed - feature is additive and uses localStorage.