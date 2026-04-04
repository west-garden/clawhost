import { NextRequest, NextResponse } from "next/server";
import { fetchApiWithToken } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = request.cookies.get("token")?.value;

  const data = await fetchApiWithToken(
    `/api/v1/agents/${id}/channels`,
    token
  );

  return NextResponse.json(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = request.cookies.get("token")?.value;
  const body = await request.json();

  const data = await fetchApiWithToken(
    `/api/v1/agents/${id}/channels`,
    token,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );

  return NextResponse.json(data);
}
