import { NextRequest, NextResponse } from "next/server";
import { fetchApiWithToken } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = request.cookies.get("token")?.value;

  const data = await fetchApiWithToken(
    `/api/v1/agents/${id}/channels/wechat/login/status`,
    token
  );

  return NextResponse.json(data);
}
