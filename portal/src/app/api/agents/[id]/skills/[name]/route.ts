import { NextRequest, NextResponse } from "next/server";
import { fetchApiWithToken } from "@/lib/api";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; name: string }> }
) {
  const { id, name } = await params;
  const token = request.cookies.get("token")?.value;

  const data = await fetchApiWithToken(
    `/api/v1/agents/${id}/skills/${name}`,
    token,
    {
      method: "DELETE",
    }
  );

  return NextResponse.json(data);
}