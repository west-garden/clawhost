import { getAgentConnect } from "@/lib/api";
import { ManagementPanel } from "@/components/management-panel";

export default async function AgentManagementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let connectInfo = null;

  try {
    connectInfo = await getAgentConnect(id);
  } catch {
    // Connect info not available yet (agent may be starting)
  }

  return <ManagementPanel connectInfo={connectInfo} />;
}
