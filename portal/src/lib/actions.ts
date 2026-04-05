"use server";

import { revalidatePath } from "next/cache";
import { getAccessToken } from "./auth";
import type { ApiResponse, AgentCreateResponse, MarketplaceSkill } from "@/types";

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

export async function resetAgent(id: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${id}/reset`, {
    method: "POST",
  });
  const data = (await res.json()) as ApiResponse;
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to reset agent" };
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
  config: Record<string, unknown>
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

// --- Provider API Key Validation ---

export async function validateProviderApiKey(
  providerName: string,
  apiKey: string,
  baseUrl?: string,
  validationModel?: string
) {
  const res = await fetchWithAuth(`/api/v1/providers/${providerName}/validate`, {
    method: "POST",
    body: JSON.stringify({ apiKey, baseUrl, validationModel }),
  });
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { valid: false, error: data.message || "Validation failed" };
  }
  return data.data as { valid: boolean; error?: string };
}

export async function validateCustomProviderApiKey(
  baseUrl: string,
  apiKey: string,
  api: string,
  validationModel?: string
) {
  const res = await fetchWithAuth("/api/v1/providers/validate-custom", {
    method: "POST",
    body: JSON.stringify({ baseUrl, apiKey, api, validationModel }),
  });
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { valid: false, error: data.message || "Validation failed", models: undefined as undefined };
  }
  return data.data as { valid: boolean; error?: string; models?: string[] };
}

export async function fetchCustomProviderModels(
  baseUrl: string,
  apiKey: string,
  api: string
) {
  const res = await fetchWithAuth("/api/v1/providers/fetch-models", {
    method: "POST",
    body: JSON.stringify({ baseUrl, apiKey, api }),
  });
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to fetch models" };
  }
  return { models: data.data?.models as string[] | undefined };
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

// --- Channels ---

export async function listChannelPairingRequests(agentId: string, channel: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/channels/${channel}/pairing`);
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to list pairing requests" };
  }
  return { requests: data.data?.requests || [], channel: data.data?.channel };
}

export async function approveChannelPairing(agentId: string, channel: string, code: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/channels/${channel}/pairing/approve`, {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to approve pairing" };
  }
  return { success: true };
}

export async function revokeChannelPairing(agentId: string, channel: string, userId: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/channels/${channel}/pairing/revoke`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to revoke pairing" };
  }
  return { success: true };
}

export async function listChannelPairedUsers(agentId: string, channel: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/channels/${channel}/pairing/users`);
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to list paired users" };
  }
  return { users: data.data?.users || [] };
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

// --- Skill Install/Create ---

export async function installSkill(agentId: string, urlOrSpec: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/skills/install`, {
    method: "POST",
    body: JSON.stringify({ source: "github", spec: urlOrSpec }),
  });
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to install skill" };
  }
  revalidatePath(`/agents/${agentId}`);
  return { success: true, name: data.data?.name };
}

export async function createSkill(agentId: string, name: string, content: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/skills/create`, {
    method: "POST",
    body: JSON.stringify({ name, content }),
  });
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to create skill" };
  }
  revalidatePath(`/agents/${agentId}`);
  return { success: true, name: data.data?.name };
}

// --- Cron Jobs ---

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  timezone?: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

export async function listCronJobs(agentId: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/cron`);
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to list cron jobs" };
  }
  return { jobs: (data.data?.jobs || []) as CronJob[] };
}

export async function runCronJob(agentId: string, jobId: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/cron/${jobId}/run`, {
    method: "POST",
  });
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to run cron job" };
  }
  return { success: true };
}

export async function toggleCronJob(agentId: string, jobId: string, enabled: boolean) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/cron/${jobId}/toggle`, {
    method: "POST",
    body: JSON.stringify({ enabled }),
  });
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to toggle cron job" };
  }
  return { success: true };
}

export async function deleteCronJob(agentId: string, jobId: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/cron/${jobId}`, {
    method: "DELETE",
  });
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to delete cron job" };
  }
  revalidatePath(`/agents/${agentId}`);
  return { success: true };
}

// --- Marketplace Skills ---

export async function listMarketplaceSkills(
  category?: string,
  search?: string
) {
  const params = new URLSearchParams();
  if (category) params.append("category", category);
  if (search) params.append("search", search);

  const queryString = params.toString();
  const path = queryString
    ? `/api/v1/marketplace/skills?${queryString}`
    : "/api/v1/marketplace/skills";

  const res = await fetchWithAuth(path);
  const data = (await res.json()) as ApiResponse<{
    skills: MarketplaceSkill[];
    categories: string[];
  }>;

  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to fetch marketplace" };
  }

  return {
    skills: data.data?.skills || [],
    categories: data.data?.categories || [],
  };
}

export async function installMarketplaceSkill(agentId: string, skillName: string) {
  const res = await fetchWithAuth(
    `/api/v1/agents/${agentId}/skills/install-marketplace`,
    {
      method: "POST",
      body: JSON.stringify({ skill_name: skillName }),
    }
  );

  const data = (await res.json()) as ApiResponse<{ name: string; installed: boolean }>;
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to install skill" };
  }

  revalidatePath(`/agents/${agentId}/skills`);
  return { success: true, name: data.data?.name };
}
