import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.CLAWHOST_API_URL || "http://localhost:18080";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  // Fetch the OAuth redirect URL from ClawHost server-side
  // ClawHost returns a 302 redirect to the OAuth provider
  const res = await fetch(`${API_URL}/auth/oauth/${provider}`, {
    redirect: "manual", // Don't follow redirect, capture the Location header
  });

  const location = res.headers.get("location");
  if (!location) {
    return NextResponse.json(
      { message: "OAuth provider not configured" },
      { status: 500 }
    );
  }

  // Redirect the browser to the OAuth provider's URL (github.com, google.com)
  return NextResponse.redirect(location);
}
