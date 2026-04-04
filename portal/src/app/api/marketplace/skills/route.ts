import { NextRequest, NextResponse } from "next/server";
import { fetchApiWithToken } from "@/lib/api";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("token")?.value;

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");

  const params = new URLSearchParams();
  if (category) params.append("category", category);
  if (search) params.append("search", search);

  const queryString = params.toString();
  const path = queryString
    ? `/api/v1/marketplace/skills?${queryString}`
    : "/api/v1/marketplace/skills";

  const data = await fetchApiWithToken(path, token);

  return NextResponse.json(data);
}