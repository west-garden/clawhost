"use server";

import { revalidatePath } from "next/cache";
import { getAccessToken } from "./auth";
import type { ApiResponse, AgentCreateResponse } from "@/types";

const API_URL = process.env.CLAWHOST_API_URL || "http://localhost:18080";

async function fetchWithAuth(path: string, options: RequestInit = {}) {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(`${API_URL}${path}`, { ...options, headers, cache: "no-store" });
}

export async function createAgent(name: string) {
  const res = await fetchWithAuth("/api/v1/agents", {
    method: "POST",
    body: JSON.stringify({ name }),
  });

  const data = (await res.json()) as ApiResponse<AgentCreateResponse>;
  if (!res.ok || data.code !== 0 || !data.data) {
    return { error: data.message || "Failed to create agent" };
  }

  revalidatePath("/");
  return { success: true, id: data.data.id };
}

export async function startAgent(id: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${id}/start`, {
    method: "POST",
  });
  const data = (await res.json()) as ApiResponse;
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to start agent" };
  }
  revalidatePath(`/agents/${id}`);
  return { success: true };
}

export async function stopAgent(id: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${id}/stop`, {
    method: "POST",
  });
  const data = (await res.json()) as ApiResponse;
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to stop agent" };
  }
  revalidatePath(`/agents/${id}`);
  return { success: true };
}

export async function restartAgent(id: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${id}/restart`, {
    method: "POST",
  });
  const data = (await res.json()) as ApiResponse;
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to restart agent" };
  }
  revalidatePath(`/agents/${id}`);
  return { success: true };
}

export async function deleteAgent(id: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${id}`, {
    method: "DELETE",
  });
  const data = (await res.json()) as ApiResponse;
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to delete agent" };
  }
  revalidatePath("/");
  return { success: true };
}

export async function resetAgentToken(id: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${id}/reset-token`, {
    method: "POST",
  });
  const data = (await res.json()) as ApiResponse;
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to reset token" };
  }
  revalidatePath(`/agents/${id}`);
  return { success: true };
}

export async function addChannel(
  agentId: string,
  channel: string,
  config: Record<string, string>
) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/channels`, {
    method: "POST",
    body: JSON.stringify({ channel, ...config }),
  });
  const data = (await res.json()) as ApiResponse;
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to add channel" };
  }
  return { success: true };
}

export async function removeChannel(agentId: string, channel: string) {
  const res = await fetchWithAuth(
    `/api/v1/agents/${agentId}/channels/${channel}`,
    { method: "DELETE" }
  );
  const data = (await res.json()) as ApiResponse;
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to remove channel" };
  }
  return { success: true };
}

export async function updateProfile(name: string) {
  const res = await fetchWithAuth("/auth/me", {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
  const data = (await res.json()) as ApiResponse;
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to update profile" };
  }
  revalidatePath("/settings");
  return { success: true };
}

export async function changePassword(oldPassword: string, newPassword: string) {
  const res = await fetchWithAuth("/auth/me/password", {
    method: "PUT",
    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
  });
  const data = (await res.json()) as ApiResponse;
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to change password" };
  }
  return { success: true };
}
