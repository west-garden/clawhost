import { NextRequest, NextResponse } from "next/server";
import { fetchApiWithToken } from "@/lib/api";
import type { AgentStatusResponse } from "@/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = request.cookies.get("token")?.value;

  const data = await fetchApiWithToken<AgentStatusResponse>(
    `/api/v1/agents/${id}/status`,
    token
  );

  return NextResponse.json(data);
}
