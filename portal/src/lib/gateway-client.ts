/**
 * Simplified WebSocket client for connecting to the OpenClaw gateway.
 * Handles connection state, keepalive, and auto-reconnect.
 *
 * Similar to WestClaw's GatewayChatClient but simplified for ClawHost's use case.
 */

export type ConnectionState = "connecting" | "connected" | "disconnected";

export type GatewayEvent = {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
};

export type GatewayHelloOk = {
  type: "hello-ok";
  protocol: number;
  features?: { methods?: string[]; events?: string[] };
  snapshot?: {
    sessionDefaults?: {
      mainSessionKey?: string;
      defaultAgentId?: string;
    };
    [key: string]: unknown;
  };
};

export type GatewayClientOptions = {
  url: string;
  token?: string;
  onConnected?: (hello: GatewayHelloOk) => void;
  onDisconnected?: () => void;
  onEvent?: (evt: GatewayEvent) => void;
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
};

/** Keepalive interval (ms). */
const KEEPALIVE_INTERVAL_MS = 25_000;
/** If a keepalive ping doesn't get a pong within this time, assume dead. */
const KEEPALIVE_TIMEOUT_MS = 10_000;
/** Maximum reconnect backoff (ms). */
const MAX_BACKOFF_MS = 15_000;
/** Initial reconnect backoff (ms). */
const INITIAL_BACKOFF_MS = 800;

export class GatewayClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private closed = false;
  private connectSent = false;
  private backoffMs = INITIAL_BACKOFF_MS;
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  private keepaliveTimeout: ReturnType<typeof setTimeout> | null = null;
  private authenticated = false;

  constructor(private opts: GatewayClientOptions) {}

  start(): void {
    this.closed = false;
    this.backoffMs = INITIAL_BACKOFF_MS;
    this.doConnect();
  }

  stop(): void {
    this.closed = true;
    this.stopKeepalive();
    this.ws?.close(1000, "client stopped");
    this.ws = null;
    this.flushPending(new Error("client stopped"));
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.authenticated;
  }

  request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("gateway not connected"));
    }
    const id = crypto.randomUUID();
    const frame = { type: "req", id, method, params };
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (v) => resolve(v as T), reject });
      this.ws!.send(JSON.stringify(frame));
    });
  }

  // --- internal ---

  private doConnect(): void {
    if (this.closed) return;
    this.connectSent = false;
    this.authenticated = false;

    const ws = new WebSocket(this.opts.url);
    this.ws = ws;

    ws.addEventListener("open", () => {
      // Wait for challenge from gateway
    });

    ws.addEventListener("message", (ev) => {
      this.handleMessage(String(ev.data ?? ""));
    });

    ws.addEventListener("close", () => {
      this.ws = null;
      this.authenticated = false;
      this.stopKeepalive();
      this.flushPending(new Error("gateway disconnected"));
      this.opts.onDisconnected?.();
      this.scheduleReconnect();
    });

    ws.addEventListener("error", (e) => {
      console.warn("[gateway-client] WebSocket error:", e);
    });
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 1.7, MAX_BACKOFF_MS);
    setTimeout(() => this.doConnect(), delay);
  }

  private sendConnect(): void {
    if (this.connectSent || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.connectSent = true;

    const params = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: "openclaw-control-ui",
        version: "1.0.0",
        platform: navigator.platform ?? "web",
        mode: "webchat",
      },
      role: "operator",
      scopes: ["operator.admin", "operator.pairing"],
      caps: ["tool-events"],
      auth: this.opts.token ? { token: this.opts.token } : undefined,
      userAgent: navigator.userAgent,
      locale: navigator.language,
    };

    this.request<GatewayHelloOk>("connect", params)
      .then((hello) => {
        this.backoffMs = INITIAL_BACKOFF_MS;
        this.authenticated = true;
        this.startKeepalive();
        this.opts.onConnected?.(hello);
      })
      .catch((err) => {
        console.warn("[gateway-client] connect handshake failed:", err);
        this.ws?.close(1000, "handshake failed");
      });
  }

  // --- keepalive ---

  private startKeepalive(): void {
    this.stopKeepalive();
    this.keepaliveTimer = setInterval(() => this.sendPing(), KEEPALIVE_INTERVAL_MS);
  }

  private stopKeepalive(): void {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
    if (this.keepaliveTimeout) {
      clearTimeout(this.keepaliveTimeout);
      this.keepaliveTimeout = null;
    }
  }

  private sendPing(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.authenticated) return;

    this.keepaliveTimeout = setTimeout(() => {
      console.warn("[gateway-client] keepalive timeout — closing connection");
      this.ws?.close(1000, "keepalive timeout");
    }, KEEPALIVE_TIMEOUT_MS);

    this.request("sessions.list", { limit: 1 })
      .then(() => {
        if (this.keepaliveTimeout) {
          clearTimeout(this.keepaliveTimeout);
          this.keepaliveTimeout = null;
        }
      })
      .catch((err) => {
        console.warn("[gateway-client] keepalive ping failed:", err);
      });
  }

  // --- message handling ---

  private handleMessage(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const frame = parsed as { type?: string };

    if (frame.type === "event") {
      const evt = parsed as GatewayEvent;
      // Gateway sends connect.challenge first — respond with connect request
      if (evt.event === "connect.challenge") {
        const payload = evt.payload as { nonce?: string } | undefined;
        if (payload?.nonce) {
          this.sendConnect();
        }
        return;
      }
      this.opts.onEvent?.(evt);
      return;
    }

    if (frame.type === "res") {
      const res = parsed as {
        id: string;
        ok: boolean;
        payload?: unknown;
        error?: { message?: string };
      };
      const pending = this.pending.get(res.id);
      if (!pending) return;
      this.pending.delete(res.id);
      if (res.ok) {
        pending.resolve(res.payload);
      } else {
        pending.reject(new Error(res.error?.message ?? "request failed"));
      }
    }
  }

  private flushPending(err: Error): void {
    for (const [, p] of this.pending) {
      p.reject(err);
    }
    this.pending.clear();
  }
}