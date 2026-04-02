import { notFound } from "next/navigation";
import { getAgent, getAgentConnect, ApiError } from "@/lib/api";
import { ManagementPanel } from "@/components/management-panel";

export default async function AgentManagementPage({
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
      // Connect info not available yet
    }
  }

  return <ManagementPanel agent={agent} connectInfo={connectInfo} />;
}
