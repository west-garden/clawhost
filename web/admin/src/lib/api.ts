const API_BASE = "/api/v1/admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  status: "active" | "disabled";
  created_at: string;
}

export async function getProfile(): Promise<User> {
  const res = await fetch("/api/auth/me", {
    credentials: "include",
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || `Request failed: ${res.status}`);
  }
  return json.data;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ code: number; message: string; data: T }> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || `Request failed: ${res.status}`);
  }
  return json;
}

// App types
export interface App {
  id: string;
  name: string;
  url: string;
  description: string;
  owner_email: string;
  api_token: string;
  bot_domain_template: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// Bot types
export interface Bot {
  id: string;
  app_id: string;
  user_id: string;
  name: string;
  slug: string;
  access_token: string;
  access_url: string;
  status: "created" | "starting" | "running" | "stopped" | "error";
  config: Record<string, unknown>;
  endpoint: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

// App APIs
export async function listApps() {
  return request<App[]>("/apps");
}

export async function getApp(id: string) {
  return request<App>(`/apps/${id}`);
}

export async function createApp(data: {
  name: string;
  url?: string;
  description?: string;
  owner_email?: string;
  bot_domain_template?: string;
}) {
  return request<App>("/apps", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateApp(
  id: string,
  data: {
    name?: string;
    url?: string;
    description?: string;
    owner_email?: string;
    bot_domain_template?: string;
    status?: string;
  }
) {
  return request<App>(`/apps/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteApp(id: string) {
  return request<{ message: string }>(`/apps/${id}`, {
    method: "DELETE",
  });
}

export async function resetAppToken(id: string) {
  return request<{ api_token: string }>(`/apps/${id}/reset-token`, {
    method: "POST",
  });
}

// Bot APIs
export async function createBot(data: {
  app_id: string;
  user_id?: string;
  name: string;
  slug?: string;
}) {
  return request<Bot>("/bots", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function listBots() {
  return request<Bot[]>("/bots");
}

export async function startBot(id: string) {
  return request<Bot>(`/bots/${id}/start`, { method: "POST" });
}

export async function stopBot(id: string) {
  return request<Bot>(`/bots/${id}/stop`, { method: "POST" });
}

export async function deleteBot(id: string) {
  return request<{ message: string }>(`/bots/${id}`, { method: "DELETE" });
}

export async function upgradeBot(id: string) {
  return request<Bot>(`/bots/${id}/upgrade`, { method: "POST" });
}

export async function upgradeAllBots() {
  return request<{ message: string }>("/bots/upgrade", { method: "POST" });
}

export async function restartAllBots() {
  return request<{ message: string }>("/bots/restart", { method: "POST" });
}

// Config APIs
export async function getAdminConfig() {
  return request<{ bot_domain_template: string }>("/config");
}

// User APIs
export async function listUsers() {
  return request<User[]>("/users");
}

export async function updateUser(id: string, data: { role?: string; status?: string }) {
  return request<User>(`/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
