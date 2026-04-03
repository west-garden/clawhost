import { getAccessToken } from "@/lib/auth";
import { fetchApi } from "@/lib/api";
import type { AgentConnectResponse } from "@/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = await getAccessToken();
  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get agent connect info to find the proxy URL
  let connectInfo: AgentConnectResponse;
  try {
    connectInfo = await fetchApi<AgentConnectResponse>(
      `/api/v1/agents/${id}/connect`
    );
  } catch {
    return Response.json(
      { error: "Agent not available" },
      { status: 503 }
    );
  }

  if (!connectInfo.endpoint) {
    return Response.json(
      { error: "Agent not running" },
      { status: 503 }
    );
  }

  const body = await request.json();

  // Extract model from body (format: "provider/model")
  // OpenClaw requires model to be "openclaw" or "openclaw/<agentId>"
  // We don't pass model, let OpenClaw use its default model configuration
  const { model: _, ...restBody } = body;

  // Proxy to the agent's OpenAI-compatible chat completions endpoint
  // Endpoint is host:port format, add http:// scheme
  const agentUrl = `http://${connectInfo.endpoint}/v1/chat/completions`;

  const requestBody: Record<string, unknown> = {
    ...restBody,
    stream: true,
  };

  const agentRes = await fetch(agentUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${connectInfo.token}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!agentRes.ok) {
    const errText = await agentRes.text().catch(() => "Unknown error");
    return Response.json(
      { error: errText },
      { status: agentRes.status }
    );
  }

  // Stream the SSE response through
  return new Response(agentRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
