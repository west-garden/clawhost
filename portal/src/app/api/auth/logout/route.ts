import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ message: "logged out" });
  response.cookies.delete("token");
  response.cookies.delete("refresh");
  return response;
}
