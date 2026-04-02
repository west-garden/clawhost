import { notFound } from "next/navigation";
import { getAgent, getAgentConnect, ApiError } from "@/lib/api";
import { AgentDetailClient } from "./client";

export default async function AgentDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let agent;
  let connectInfo = null;

  try {
    agent = await getAgent(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      notFound();
    }
    throw e;
  }

  if (agent.status === "running") {
    try {
      connectInfo = await getAgentConnect(id);
    } catch {
      // Agent may be starting, connect info not available yet
    }
  }

  return (
    <AgentDetailClient agent={agent} connectInfo={connectInfo}>
      {children}
    </AgentDetailClient>
  );
}
