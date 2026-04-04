"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  GatewayClient,
  ConnectionState,
  GatewayHelloOk,
} from "@/lib/gateway-client";

interface UseGatewayConnectionOptions {
  agentId: string;
  enabled: boolean;
  onEvent?: (evt: { type: "event"; event: string; payload?: unknown }) => void;
}

interface GatewayConnectResponse {
  id: string;
  name: string;
  status: string;
  ready: boolean;
  token?: string;
  endpoint?: string;
  ws_url?: string;
  webchat_url?: string;
}

export function useGatewayConnection({
  agentId,
  enabled,
  onEvent,
}: UseGatewayConnectionOptions) {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const clientRef = useRef<GatewayClient | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled) {
      // Clean up when disabled
      if (clientRef.current) {
        clientRef.current.stop();
        clientRef.current = null;
      }
      setConnectionState("disconnected");
      return;
    }

    let cancelled = false;

    async function init() {
      setConnectionState("connecting");

      try {
        // Fetch connection info from backend
        const res = await fetch(`/api/agents/${agentId}/connect`);
        if (!res.ok) {
          throw new Error("Failed to get connection info");
        }

        const data: GatewayConnectResponse = (await res.json()).data;
        if (cancelled) return;

        if (!data.ws_url || !data.token) {
          // No WebSocket URL available (agent not running)
          setConnectionState("disconnected");
          return;
        }

        const client = new GatewayClient({
          url: data.ws_url,
          token: data.token,
          onConnected: (_hello: GatewayHelloOk) => {
            if (cancelled) return;
            setConnectionState("connected");
          },
          onDisconnected: () => {
            if (cancelled) return;
            setConnectionState("connecting");
          },
          onEvent: (evt) => {
            if (cancelled) return;
            onEventRef.current?.(evt);
          },
        });

        clientRef.current = client;
        client.start();
      } catch (err) {
        if (cancelled) return;
        console.error("[useGatewayConnection] Init failed:", err);
        setConnectionState("disconnected");
      }
    }

    init();

    return () => {
      cancelled = true;
      if (clientRef.current) {
        clientRef.current.stop();
        clientRef.current = null;
      }
    };
  }, [agentId, enabled]);

  const reconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.stop();
      clientRef.current = null;
    }
    setConnectionState("disconnected");
    // The effect will re-run and reconnect
  }, []);

  return {
    connectionState,
    client: clientRef.current,
    reconnect,
  };
}