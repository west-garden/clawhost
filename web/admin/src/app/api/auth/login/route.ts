import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.CLAWHOST_API_URL || "http://localhost:18080";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok || data.code !== 0 || !data.data) {
    return NextResponse.json(
      { message: data.message || "Login failed" },
      { status: res.status }
    );
  }

  const { access_token, refresh_token, user } = data.data;

  // Check if user is admin
  if (user.role !== "admin") {
    return NextResponse.json(
      { message: "Admin access required" },
      { status: 403 }
    );
  }

  const response = NextResponse.json({ user });

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };

  response.cookies.set("admin_token", access_token, cookieOptions);
  response.cookies.set("admin_refresh", refresh_token, cookieOptions);

  return response;
}