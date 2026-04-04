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
  getLocalSessions,
  saveLocalSession,
  removeLocalSession,
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
  isStreaming: boolean;
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
  getIsStreaming: (sessionKey: string) => boolean;
  setIsStreaming: (sessionKey: string, value: boolean) => void;
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

      // Get Gateway session keys (to identify which local sessions are now synced)
      const gatewayKeys = new Set(filtered.map((s) => s.key));

      const chatSessions: ChatSession[] = filtered.map((s) => {
        const m = meta.get(s.key);
        return {
          key: s.key,
          id: s.key,
          title: m?.customTitle || s.derivedTitle || s.displayName || "新对话",
          model: "",
          messages: [],
          createdAt: s.updatedAt ?? Date.now(),
          updatedAt: s.updatedAt ?? Date.now(),
          pinned: m?.pinned,
        };
      });

      // Merge local sessions (not yet synced to Gateway)
      const localSessions = getLocalSessions(agentId);
      for (const localSession of localSessions) {
        const sessionKey = localSession.key;
        if (!sessionKey) continue;

        if (!gatewayKeys.has(sessionKey) && !archived.has(sessionKey)) {
          // Local session not yet in Gateway, add to list
          const m = meta.get(sessionKey);
          chatSessions.unshift({
            ...localSession,
            title: m?.customTitle || localSession.title,
            pinned: m?.pinned,
          });
        } else {
          // Session now exists in Gateway, remove from local storage
          removeLocalSession(agentId, sessionKey);
        }
      }

      // Apply custom order or default sort
      const customOrder = customOrderRef.current;
      if (customOrder && customOrder.length > 0) {
        const orderMap = new Map(customOrder.map((key, i) => [key, i]));
        chatSessions.sort((a, b) => {
          const pa = a.pinned ? 1 : 0;
          const pb = b.pinned ? 1 : 0;
          if (pa !== pb) return pb - pa;
          const aKey = a.key;
          const bKey = b.key;
          if (!aKey || !bKey) return aKey ? -1 : bKey ? 1 : 0;
          const oa = orderMap.get(aKey);
          const ob = orderMap.get(bKey);
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
        const firstKey = chatSessions[0].key;
        if (firstKey) setActiveKey(firstKey);
      }
    } catch (err) {
      console.error("[useWsChatSessions] Failed to fetch sessions:", err);
    }
  }, [client, agentId]);

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
      isStreaming: false,
    });
  }, [loadHistory]);

  // Create a new session (optimistic)
  const createNewSession = useCallback(() => {
    const newKey = generateSessionKey();
    const newSession: ChatSession = {
      key: newKey,
      id: newKey,
      title: "新对话",
      model: "",
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
      isStreaming: false,
    });

    // Save to localStorage (persist across refresh until Gateway creates it)
    saveLocalSession(agentId, newSession);

    // Update custom order
    if (customOrderRef.current) {
      customOrderRef.current = [newKey, ...customOrderRef.current];
      setCustomOrder(agentId, customOrderRef.current);
    } else {
      customOrderRef.current = [newKey];
      setCustomOrder(agentId, customOrderRef.current);
    }
  }, [agentId]);

  // Archive a session
  const archiveSession = useCallback((key: string) => {
    // Optimistic: add to archived set
    archivedKeysRef.current = new Set([...archivedKeysRef.current, key]);

    // Persist to localStorage
    updateSessionMeta(agentId, key, { archivedAt: Date.now() });

    // Remove from sessions list and switch active if needed
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.key !== key);
      // Switch to first session if archiving active
      if (key === activeKeyRef.current && filtered.length > 0) {
        const firstKey = filtered[0].key;
        if (firstKey) setActiveKey(firstKey);
      }
      return filtered;
    });

    // Remove from custom order
    if (customOrderRef.current) {
      customOrderRef.current = customOrderRef.current.filter((k) => k !== key);
      setCustomOrder(agentId, customOrderRef.current);
    }

    // Remove from cache
    cacheRef.current.delete(key);
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

    // Update local session if it's a local-only session
    const localSessions = getLocalSessions(agentId);
    const localSession = localSessions.find((s) => s.key === key);
    if (localSession) {
      saveLocalSession(agentId, { ...localSession, title: title || localSession.title });
    }

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

      // Save new order (filter out undefined keys)
      const order = next.map((s) => s.key).filter((k): k is string => k !== undefined);
      customOrderRef.current = order;
      setCustomOrder(agentId, order);

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
    const cached = cacheRef.current.get(activeKeyRef.current);
    cacheRef.current.set(activeKeyRef.current, {
      messages,
      lastAccessed: Date.now(),
      isStreaming: cached?.isStreaming ?? false,
    });
  }, []);

  // Get streaming state for a specific session
  const getIsStreaming = useCallback((sessionKey: string): boolean => {
    const cached = cacheRef.current.get(sessionKey);
    return cached?.isStreaming ?? false;
  }, []);

  // Set streaming state for a specific session
  const setIsStreaming = useCallback((sessionKey: string, value: boolean) => {
    const cached = cacheRef.current.get(sessionKey);
    cacheRef.current.set(sessionKey, {
      messages: cached?.messages ?? [],
      lastAccessed: cached?.lastAccessed ?? Date.now(),
      isStreaming: value,
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
    getIsStreaming,
    setIsStreaming,
  };
}