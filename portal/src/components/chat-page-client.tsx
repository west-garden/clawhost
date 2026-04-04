"use client";

import { useState, useEffect } from "react";
import { ChatPanel } from "@/components/chat-panel";
import { ChatSessionSidebar } from "@/components/chat-session-sidebar";
import { useChatSessions } from "@/hooks/use-chat-sessions";
import type { AgentStatus, ProviderWithModels } from "@/types";

interface ChatPageClientProps {
  agentId: string;
  agentName: string;
  initialStatus: AgentStatus;
  providers: Record<string, ProviderWithModels>;
}

export function ChatPageClient({
  agentId,
  agentName,
  initialStatus,
  providers,
}: ChatPageClientProps) {
  // Get default model from first provider with models
  const defaultModel = (() => {
    for (const [providerName, provider] of Object.entries(providers)) {
      if (provider.models && provider.models.length > 0) {
        return `${providerName}/${provider.models[0].id}`;
      }
    }
    return "default";
  })();

  const {
    sessions,
    activeSession,
    isLoading,
    createNewSession,
    switchSession,
    removeSession,
    addUserMessage,
    updateLastAssistantMessage,
    setModel,
  } = useChatSessions({
    agentId,
    defaultModel,
  });

  // Create initial session if none exists (only after localStorage loaded)
  useEffect(() => {
    if (!isLoading && sessions.length === 0) {
      createNewSession();
    }
  }, [isLoading, sessions.length, createNewSession]);

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
        agentId={agentId}
        agentName={agentName}
        initialStatus={initialStatus}
        activeSession={activeSession}
        onAddUserMessage={addUserMessage}
        onUpdateLastAssistantMessage={updateLastAssistantMessage}
        onSetModel={setModel}
        providers={providers}
      />
    </div>
  );
}