import { notFound } from "next/navigation";
import { getAgent, getAgentConnect, ApiError } from "@/lib/api";
import { AgentOverview } from "./overview";

export default async function AgentDetailPage({
  params,
}: {
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

  return <AgentOverview agent={agent} connectInfo={connectInfo} />;
}
