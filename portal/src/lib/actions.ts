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

export async function createAgent(name: string, slug?: string, soulMd?: string) {
  const body: Record<string, unknown> = { name };
  if (slug) body.slug = slug;
  if (soulMd) body.config = { soul_md: soulMd };

  const res = await fetchWithAuth("/api/v1/agents", {
    method: "POST",
    body: JSON.stringify(body),
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

// --- Config Models ---

export async function listModelProviders(agentId: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/config/models`);
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to list providers" };
  }
  return { providers: data.data };
}

export async function addModelProvider(agentId: string, provider: {
  name: string;
  baseUrl?: string;
  apiKey?: string;
  auth?: string;
  api?: string;
  models?: Array<{ id: string; name?: string }>;
}) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/config/models`, {
    method: "POST",
    body: JSON.stringify(provider),
  });
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to add provider" };
  }
  revalidatePath(`/agents/${agentId}`);
  return { success: true };
}

export async function updateModelProvider(
  agentId: string,
  providerName: string,
  provider: { baseUrl?: string; apiKey?: string; auth?: string; api?: string; models?: Array<{ id: string; name?: string }> }
) {
  const res = await fetchWithAuth(
    `/api/v1/agents/${agentId}/config/models/${providerName}`,
    {
      method: "PUT",
      body: JSON.stringify(provider),
    }
  );
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to update provider" };
  }
  revalidatePath(`/agents/${agentId}`);
  return { success: true };
}

export async function deleteModelProvider(agentId: string, providerName: string) {
  const res = await fetchWithAuth(
    `/api/v1/agents/${agentId}/config/models/${providerName}`,
    { method: "DELETE" }
  );
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to delete provider" };
  }
  revalidatePath(`/agents/${agentId}`);
  return { success: true };
}

// --- Config Defaults ---

export async function getAgentDefaults(agentId: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/config/defaults`);
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to get defaults" };
  }
  return { defaults: data.data };
}

export async function setAgentDefaults(agentId: string, defaults: Record<string, unknown>) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/config/defaults`, {
    method: "PUT",
    body: JSON.stringify(defaults),
  });
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to set defaults" };
  }
  revalidatePath(`/agents/${agentId}`);
  return { success: true };
}

// --- Raw Config ---

export async function getAgentRawConfig(agentId: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/config/raw`);
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to get raw config" };
  }
  return { config: data.data };
}

export async function updateAgentRawConfig(agentId: string, config: Record<string, unknown>) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/config/raw`, {
    method: "PUT",
    body: JSON.stringify(config),
  });
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to update raw config" };
  }
  revalidatePath(`/agents/${agentId}`);
  return { success: true };
}

// --- Skills ---

export async function listSkills(agentId: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/skills`);
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to list skills" };
  }
  return { skills: data.data };
}

export async function deleteSkill(agentId: string, skillName: string) {
  const res = await fetchWithAuth(
    `/api/v1/agents/${agentId}/skills/${skillName}`,
    { method: "DELETE" }
  );
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to delete skill" };
  }
  revalidatePath(`/agents/${agentId}`);
  return { success: true };
}

// --- Devices ---

export async function listDevices(agentId: string, status?: string) {
  const query = status ? `?status=${status}` : "";
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/devices${query}`);
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to list devices" };
  }
  return { devices: data.data?.devices || [] };
}

export async function approveDevice(agentId: string, requestId: string) {
  const res = await fetchWithAuth(
    `/api/v1/agents/${agentId}/devices/${requestId}/approve`,
    { method: "POST" }
  );
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to approve device" };
  }
  revalidatePath(`/agents/${agentId}`);
  return { success: true };
}

export async function revokeDevice(agentId: string, deviceId: string) {
  const res = await fetchWithAuth(
    `/api/v1/agents/${agentId}/devices/${deviceId}`,
    { method: "DELETE" }
  );
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to revoke device" };
  }
  revalidatePath(`/agents/${agentId}`);
  return { success: true };
}
