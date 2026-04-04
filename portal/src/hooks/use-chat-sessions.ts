"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  isLoading: boolean;
  createNewSession: () => void;
  switchSession: (id: string) => void;
  removeSession: (id: string) => void;
  addUserMessage: (content: string, sessionId?: string) => void;
  addAssistantMessage: (content: string, sessionId?: string) => void;
  updateLastAssistantMessage: (content: string, sessionId?: string) => void;
  setModel: (model: string, sessionId?: string) => void;
  clearMessages: (sessionId?: string) => void;
}

export function useChatSessions({
  agentId,
  defaultModel,
}: UseChatSessionsOptions): UseChatSessionsReturn {
  const [storage, setStorage] = useState<SessionsStorage>({
    sessions: [],
    activeSessionId: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Debounced save ref
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const storageRef = useRef<SessionsStorage>(storage);

  // Immediate save function (called on critical updates)
  const saveImmediately = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (storageRef.current.sessions.length > 0 || storageRef.current.activeSessionId) {
      saveSessions(agentId, storageRef.current);
    }
  }, [agentId]);

  // Load sessions from localStorage on mount
  useEffect(() => {
    const loaded = getSessions(agentId);
    setStorage(loaded);
    storageRef.current = loaded;
    setIsLoading(false);
  }, [agentId]);

  // Debounced save to localStorage (500ms delay)
  useEffect(() => {
    if (storage.sessions.length > 0 || storage.activeSessionId) {
      storageRef.current = storage;
      // Clear pending save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Schedule save
      saveTimeoutRef.current = setTimeout(() => {
        saveSessions(agentId, storageRef.current);
      }, 500);
    }
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
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
    (updater: (session: ChatSession) => ChatSession, sessionId?: string) => {
      setStorage((prev) => {
        const targetId = sessionId || prev.activeSessionId;
        const session = prev.sessions.find((s) => s.id === targetId);
        if (!session) return prev;

        const updated = updater(session);
        return {
          ...prev,
          sessions: prev.sessions.map((s) => (s.id === updated.id ? updated : s)),
        };
      });
    },
    []
  );

  const addUserMessage = useCallback(
    (content: string, sessionId?: string) => {
      updateActiveSession((s) => addMessage(s, "user", content), sessionId);
    },
    [updateActiveSession]
  );

  const addAssistantMessage = useCallback(
    (content: string, sessionId?: string) => {
      updateActiveSession((s) => addMessage(s, "assistant", content), sessionId);
    },
    [updateActiveSession]
  );

  const updateLastAssistantMessage = useCallback(
    (content: string, sessionId?: string) => {
      // Use provided sessionId or fall back to current activeSession
      const targetSessionId = sessionId || activeSession?.id;
      if (!targetSessionId) return;

      setStorage((prev) => {
        const session = prev.sessions.find((s) => s.id === targetSessionId);
        if (!session) return prev;

        const messages = [...session.messages];
        const lastMessage = messages[messages.length - 1];

        if (lastMessage && lastMessage.role === "assistant") {
          messages[messages.length - 1] = {
            ...lastMessage,
            content,
            timestamp: Date.now(),
          };
        } else {
          messages.push({
            id: crypto.randomUUID(),
            role: "assistant",
            content,
            timestamp: Date.now(),
          });
        }

        const updated = {
          ...session,
          messages,
          updatedAt: Date.now(),
        };

        return {
          ...prev,
          sessions: prev.sessions.map((s) => (s.id === updated.id ? updated : s)),
        };
      });
    },
    [activeSession]
  );

  const setModel = useCallback(
    (model: string, sessionId?: string) => {
      updateActiveSession((s) => updateSessionModel(s, model), sessionId);
    },
    [updateActiveSession]
  );

  const clearMessages = useCallback(
    (sessionId?: string) => {
      updateActiveSession((s) => ({
        ...s,
        messages: [],
        title: "新对话",
        updatedAt: Date.now(),
      }), sessionId);
    },
    [updateActiveSession]
  );

  return {
    sessions: storage.sessions,
    activeSession,
    isActiveSession,
    isLoading,
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