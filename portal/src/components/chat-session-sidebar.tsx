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