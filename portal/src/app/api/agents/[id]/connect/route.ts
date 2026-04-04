import { NextRequest, NextResponse } from "next/server";
import { fetchApiWithToken } from "@/lib/api";
import type { AgentConnectResponse } from "@/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = request.cookies.get("token")?.value;

  const data = await fetchApiWithToken<AgentConnectResponse>(
    `/api/v1/agents/${id}/connect`,
    token
  );

  return NextResponse.json(data);
}