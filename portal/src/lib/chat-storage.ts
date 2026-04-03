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