"use client";

import { useState, useEffect, useCallback } from "react";
import type { ChatSession, SessionsStorage } from "@/types";
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
  updateLastAssistantMessage: (content: string) => void;
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
    updateLastAssistantMessage,
    setModel,
    clearMessages,
  };
}