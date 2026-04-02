import { NextRequest, NextResponse } from "next/server";
import { fetchApiRaw } from "@/lib/api";
import type { ApiResponse, AuthTokens } from "@/types";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const res = await fetchApiRaw("/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as ApiResponse<AuthTokens>;

  if (!res.ok || data.code !== 0 || !data.data) {
    return NextResponse.json(
      { message: data.message || "Registration failed" },
      { status: res.status }
    );
  }

  const { access_token, refresh_token, user } = data.data;

  const response = NextResponse.json({ user });

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };

  response.cookies.set("token", access_token, cookieOptions);
  response.cookies.set("refresh", refresh_token, cookieOptions);

  return response;
}
