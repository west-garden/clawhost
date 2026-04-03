import { notFound } from "next/navigation";
import { getAgent, ApiError } from "@/lib/api";
import { listModelProviders } from "@/lib/actions";
import { ChatPageClient } from "@/components/chat-page-client";

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

  // Load model providers
  const result = await listModelProviders(id);
  const providers = result.providers || {};

  return (
    <ChatPageClient
      agentId={agent.id}
      agentName={agent.name}
      initialStatus={agent.status}
      providers={providers}
    />
  );
}