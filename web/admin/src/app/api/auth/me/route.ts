import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.CLAWHOST_API_URL || "http://localhost:18080";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;

  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const data = await res.json();
  return NextResponse.json({ user: data.data });
}