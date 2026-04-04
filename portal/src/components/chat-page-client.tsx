"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChatPanel } from "@/components/chat-panel";
import { ChatSessionSidebar } from "@/components/chat-session-sidebar";
import { useGatewayConnection } from "@/hooks/use-gateway-connection";
import { useWsChatSessions } from "@/hooks/use-ws-chat-sessions";
import { useWsChat } from "@/hooks/use-ws-chat";
import type { GatewayEvent } from "@/lib/gateway-client";
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

  // Agent status
  const [currentStatus, setCurrentStatus] = useState(initialStatus);

  // Gateway connection with event handling
  const handleGatewayEvent = useCallback((evt: GatewayEvent) => {
    wsChatRef.current?.handleEvent(evt);
  }, []);

  const { connectionState, client } = useGatewayConnection({
    agentId,
    enabled: currentStatus === "running",
    onEvent: handleGatewayEvent,
  });

  const isConnected = connectionState === "connected";
  const isConnecting = connectionState === "connecting";

  // Session management
  const {
    sessions,
    activeSessionKey,
    activeSession,
    isLoading: sessionsLoading,
    switchSession,
    createNewSession,
    archiveSession,
    togglePin,
    renameSession,
    reorderSessions,
    refreshSessions,
    getActiveMessages,
    updateActiveMessages,
  } = useWsChatSessions({
    agentId,
    client,
    connected: isConnected,
  });

  // Ref for wsChat to call handleEvent
  const wsChatRef = useRef<ReturnType<typeof useWsChat> | null>(null);

  // Chat management
  const wsChat = useWsChat({
    client,
    connected: isConnected,
    sessionKey: activeSessionKey,
    getMessages: getActiveMessages,
    updateMessages: updateActiveMessages,
  });
  wsChatRef.current = wsChat;

  const messages = getActiveMessages();
  const isStreaming = wsChat.isStreaming;

  // Update session messages in sidebar when they change
  const sessionsWithMessages = sessions.map((s) => ({
    ...s,
    messages: s.key === activeSessionKey ? messages : [],
  }));

  // Create initial session if none exists
  useEffect(() => {
    if (!sessionsLoading && sessions.length === 0 && isConnected) {
      createNewSession();
    }
  }, [sessionsLoading, sessions.length, isConnected, createNewSession]);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar */}
      <ChatSessionSidebar
        sessions={sessionsWithMessages}
        activeSessionId={activeSessionKey}
        onSelectSession={switchSession}
        onCreateSession={createNewSession}
        onDeleteSession={archiveSession}
        onTogglePin={togglePin}
        onRename={renameSession}
        onReorder={reorderSessions}
      />

      {/* Main chat area */}
      <ChatPanel
        agentId={agentId}
        agentName={agentName}
        initialStatus={currentStatus}
        activeSession={activeSession ? { ...activeSession, messages } : null}
        onAddUserMessage={() => {}} // Handled by useWsChat
        onUpdateLastAssistantMessage={() => {}} // Handled by useWsChat
        onSetModel={() => {}} // TODO: implement model switching
        providers={providers}
        // New props for WebSocket mode
        isConnected={isConnected}
        isConnecting={isConnecting}
        isStreaming={isStreaming}
        sendMessage={wsChat.sendMessage}
        abortGeneration={wsChat.abortGeneration}
      />
    </div>
  );
}