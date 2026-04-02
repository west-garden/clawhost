import { notFound } from "next/navigation";
import { getAgent, ApiError } from "@/lib/api";
import { ChatPanel } from "@/components/chat-panel";

export default async function AgentChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let agent;
  try {
    agent = await getAgent(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      notFound();
    }
    throw e;
  }

  return (
    <ChatPanel
      agentId={agent.id}
      agentName={agent.name}
      initialStatus={agent.status}
    />
  );
}
