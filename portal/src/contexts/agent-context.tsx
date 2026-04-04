"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAgentStatus } from "@/hooks/use-agent-status";
import type { AgentDetail, AgentConnectResponse, AgentStatus } from "@/types";

interface AgentContextValue {
  agent: AgentDetail;
  connectInfo: AgentConnectResponse | null;
  currentStatus: AgentStatus;
  isRunning: boolean;
}

const AgentContext = createContext<AgentContextValue | null>(null);

export function AgentProvider({
  agent,
  connectInfo: initialConnectInfo,
  children,
}: {
  agent: AgentDetail;
  connectInfo: AgentConnectResponse | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const shouldPoll = agent.status === "running" || agent.status === "starting";
  const { status: liveStatus } = useAgentStatus(agent.id, shouldPoll);
  const currentStatus = (liveStatus?.status ?? agent.status) as AgentStatus;

  // Track status changes to refresh when agent starts
  const prevStatusRef = useRef(currentStatus);
  useEffect(() => {
    if (prevStatusRef.current !== "running" && currentStatus === "running") {
      router.refresh();
    }
    prevStatusRef.current = currentStatus;
  }, [currentStatus, router]);

  return (
    <AgentContext.Provider
      value={{
        agent,
        connectInfo: initialConnectInfo,
        currentStatus,
        isRunning: currentStatus === "running",
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent() {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error("useAgent must be used within an AgentProvider");
  }
  return context;
}