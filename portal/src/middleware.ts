import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/auth/callback"];
const API_URL = process.env.CLAWHOST_API_URL || "http://localhost:18080";

function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.exp ?? null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip public paths and API routes
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("token")?.value;
  const refresh = request.cookies.get("refresh")?.value;

  // No token at all → redirect to login
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Check expiry
  const exp = decodeJwtExp(token);
  const now = Math.floor(Date.now() / 1000);

  if (exp && exp - now < 60) {
    // Token expired or near-expiry → try refresh
    if (!refresh) {
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("token");
      response.cookies.delete("refresh");
      return response;
    }

    try {
      const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });

      if (!refreshRes.ok) {
        const response = NextResponse.redirect(new URL("/login", request.url));
        response.cookies.delete("token");
        response.cookies.delete("refresh");
        return response;
      }

      const data = await refreshRes.json();
      if (data.code !== 0 || !data.data) {
        const response = NextResponse.redirect(new URL("/login", request.url));
        response.cookies.delete("token");
        response.cookies.delete("refresh");
        return response;
      }

      const response = NextResponse.next();
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      };
      response.cookies.set("token", data.data.access_token, cookieOptions);
      response.cookies.set("refresh", data.data.refresh_token, cookieOptions);
      return response;
    } catch {
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("token");
      response.cookies.delete("refresh");
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
