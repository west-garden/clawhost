import { getAccessToken } from "./auth";
import type { ApiResponse } from "@/types";

const API_URL = process.env.CLAWHOST_API_URL || "http://localhost:18080";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiResponse;
    throw new ApiError(res.status, body.message || `API error ${res.status}`);
  }
  const body = (await res.json()) as ApiResponse<T>;
  return body.data as T;
}

export async function fetchApiWithToken<T>(
  path: string,
  token: string | undefined,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });
  return (await res.json()) as ApiResponse<T>;
}

export async function fetchApiRaw(path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });
}

export { fetchApi };

export async function listAgents() {
  return fetchApi<import("@/types").Agent[]>("/api/v1/agents");
}

export async function getAgent(id: string) {
  return fetchApi<import("@/types").AgentDetail>(`/api/v1/agents/${id}`);
}

export async function getAgentConnect(id: string) {
  return fetchApi<import("@/types").AgentConnectResponse>(`/api/v1/agents/${id}/connect`);
}

export async function getProfile() {
  return fetchApi<import("@/types").User>("/auth/me");
}
