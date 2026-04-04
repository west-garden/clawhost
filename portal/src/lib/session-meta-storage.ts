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