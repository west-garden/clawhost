"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { AgentDetailHeader } from "@/components/agent-detail-header";
import { useAgentStatus } from "@/hooks/use-agent-status";
import { startAgent, stopAgent, restartAgent } from "@/lib/actions";
import type { AgentDetail, AgentConnectResponse } from "@/types";

export function AgentDetailClient({
  agent,
  connectInfo,
  children,
}: {
  agent: AgentDetail;
  connectInfo: AgentConnectResponse | null;
  children: React.ReactNode;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pollEnabled, setPollEnabled] = useState(
    agent.status === "running" || agent.status === "starting"
  );

  const { status: liveStatus } = useAgentStatus(agent.id, pollEnabled);
  const currentStatus = liveStatus?.status ?? agent.status;

  const [prevStatus, setPrevStatus] = useState(currentStatus);
  useEffect(() => {
    if (prevStatus !== "running" && currentStatus === "running") {
      router.refresh();
    }
    setPrevStatus(currentStatus);
  }, [currentStatus, prevStatus, router]);

  async function handleAction(action: "start" | "stop" | "restart") {
    const fns = { start: startAgent, stop: stopAgent, restart: restartAgent };
    setActionLoading(action);
    const result = await fns[action](agent.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t(`agent.${action}Success`));
      setPollEnabled(true);
      router.refresh();
    }
    setActionLoading(null);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <AgentDetailHeader
        agentId={agent.id}
        agentName={agent.name}
        agentSlug={agent.slug}
        currentStatus={currentStatus}
        webchatUrl={connectInfo?.webchat_url}
        actionLoading={actionLoading}
        onAction={handleAction}
      />
      {children}
    </div>
  );
}
