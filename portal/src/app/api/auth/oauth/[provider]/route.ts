import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.CLAWHOST_API_URL || "http://localhost:18080";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  return NextResponse.redirect(`${API_URL}/auth/oauth/${provider}`);
}
