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