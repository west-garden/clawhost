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

export type AgentStatus = "created" | "starting" | "running" | "stopped" | "error";

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

// --- Subscription ---

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_cents: number;
  currency: string;
  agent_limit: number;
  monthly_credits: number;
  daily_bonus: number;
  daily_bonus_cap: number;
  features: string[];
  sort_order: number;
  active: boolean;
}

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  currency: string;
  active: boolean;
  sort_order: number;
}

export interface UserSubscription {
  plan: SubscriptionPlan | null;
  status: "active" | "expired" | "cancelled" | "none";
  credits_balance: number;
  bonus_credits: number;
  current_period_end: string | null;
}

// --- Chat Sessions ---

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ChatSession {
  key?: string; // Gateway session key
  id: string;
  title: string;
  model: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  pinned?: boolean; // 置顶状态
  unread?: boolean; // 未读标记
  _isStreaming?: boolean; // 内部使用：流式消息标记
}

export interface SessionsStorage {
  sessions: ChatSession[];
  activeSessionId: string | null;
}

export interface ModelInfo {
  id: string;           // e.g., "gpt-4o"
  name: string;         // e.g., "GPT-4o"
  provider: string;     // e.g., "openai"
}

export interface ProviderWithModels {
  name: string;
  baseUrl?: string;
  models?: Array<{ id: string; name?: string }>;
}

// --- Marketplace Skills ---

export interface MarketplaceSkill {
  name: string;
  display_name: string;
  description: string;
  author: string;
  version: string;
  category: string;
  tags: string[];
  path: string;
}

// --- Gateway Types ---

export interface GatewaySession {
  key: string;
  displayName?: string;
  derivedTitle?: string;
  kind?: string;
  channel?: string;
  lastChannel?: string;
  updatedAt?: number;
  totalTokens?: number;
  totalTokensFresh?: boolean;
  spawnedBy?: boolean;
}

export interface GatewaySessionsListResult {
  sessions: GatewaySession[];
}

export interface GatewayMessage {
  role: "user" | "assistant";
  content: string | Array<{ type: "text"; text: string }>;
  timestamp?: number;
  idempotencyKey?: string;
}

export interface GatewayChatHistoryResult {
  messages?: GatewayMessage[];
}

export interface ChatEventPayload {
  state?: "delta" | "final" | "error" | "aborted";
  runId?: string;
  sessionKey?: string;
  message?: GatewayMessage;
  errorMessage?: string;
}

export interface AgentEventPayload {
  runId?: string;
  stream?: "lifecycle" | "tool" | "assistant";
  sessionKey?: string;
  data?: Record<string, unknown>;
}

// --- Session Metadata (localStorage) ---

export interface SessionMeta {
  key: string;
  pinned?: boolean;
  customTitle?: string | null;
  archivedAt?: number | null;
}
