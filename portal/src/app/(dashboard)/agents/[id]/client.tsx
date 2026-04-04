"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { AgentDetailHeader } from "@/components/agent-detail-header";
import { startAgent, stopAgent, restartAgent } from "@/lib/actions";
import { AgentProvider, useAgent } from "@/contexts/agent-context";
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
  return (
    <AgentProvider agent={agent} connectInfo={connectInfo}>
      <div className="flex-1 flex flex-col overflow-hidden">
        <AgentHeader />
        {children}
      </div>
    </AgentProvider>
  );
}

function AgentHeader() {
  const t = useTranslations();
  const router = useRouter();
  const { agent, connectInfo, currentStatus } = useAgent();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function handleAction(action: "start" | "stop" | "restart") {
    const fns = { start: startAgent, stop: stopAgent, restart: restartAgent };
    setActionLoading(action);
    const result = await fns[action](agent.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t(`agent.${action}Success`));
      router.refresh();
    }
    setActionLoading(null);
  }

  return (
    <AgentDetailHeader
      agentId={agent.id}
      agentName={agent.name}
      agentSlug={agent.slug}
      currentStatus={currentStatus}
      webchatUrl={connectInfo?.webchat_url}
      actionLoading={actionLoading}
      onAction={handleAction}
    />
  );
}