// --- User ---

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  oauth_provider?: string;
  oauth_id?: string;
  role: "user" | "admin";
  status: "active" | "disabled";
  api_token?: string;
  created_at: string;
  updated_at: string;
}

// --- Agent ---

export type AgentStatus = "created" | "running" | "stopped" | "error";

export interface Agent {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  access_token: string;
  status: AgentStatus;
  config: Record<string, unknown> | null;
  endpoint: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DeploymentStatusInfo {
  status: "ready" | "updating" | "starting" | "not_ready" | "not_found";
  ready_replicas: number;
  desired_replicas: number;
  updated_replicas: number;
}

export interface AgentDetail extends Agent {
  deployment_status?: DeploymentStatusInfo;
  image?: string;
  latest_image?: string;
  image_up_to_date?: boolean;
}

export interface AgentCreateResponse extends Agent {
  access_url: string;
}

export interface AgentStatusResponse {
  id: string;
  name: string;
  status: AgentStatus;
  ready: boolean;
  endpoint?: string;
}

export interface AgentConnectResponse {
  id: string;
  name: string;
  status: AgentStatus;
  ready: boolean;
  token?: string;
  endpoint?: string;
  ws_url?: string;
  webchat_url?: string;
}

// --- Channels ---

export interface ChannelConfig {
  [key: string]: unknown;
}

export interface WechatAccount {
  account_id: string;
  name: string;
  base_url: string;
  user_id: string;
  saved_at: string;
  configured: boolean;
}

export interface WechatLoginStatusResponse {
  status: "wait" | "scaned" | "expired" | "confirmed";
  connected: boolean;
  message: string;
  account_id?: string;
}

// --- API Response Wrapper ---

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
}

// --- Auth ---

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  user: User;
}
