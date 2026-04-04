# Gateway Connection Status Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time gateway connection status indicator to ClawHost chat panel, showing "已连接/连接中/未连接" states.

**Architecture:** WebSocket connection from Portal through ClawHost proxy to Agent gateway, with keepalive and auto-reconnect.

**Tech Stack:** React hooks, WebSocket, existing ClawHost proxy infrastructure

---

## Overview

ClawHost Portal currently has no indication when the Agent gateway is unreachable. Users see no feedback when messages fail to send due to connection issues.

This design adds a connection status indicator (like WestClaw) that shows:
- **已连接** (green dot) - Gateway is reachable
- **连接中...** (yellow dot, pulsing) - Connecting/reconnecting
- **未连接** (red dot) - Gateway unreachable, show error message

## Architecture

```
Portal (Browser)
    ↓ WebSocket (new)
ClawHost Proxy (/proxy/{agent_id}/)
    ↓ WebSocket proxy (existing)
Agent Gateway (ws://endpoint)
```

The existing `handler/proxy/proxy.go` already supports WebSocket proxying. We add:
1. Frontend `GatewayClient` class for WebSocket management
2. `useGatewayConnection` hook for React state
3. Connection status UI in `ChatPanel` footer

## Components

### 1. GatewayClient (Frontend)

Location: `portal/src/lib/gateway-client.ts`

Simplified version of WestClaw's `GatewayChatClient`:
- Connect to `/proxy/{agent_id}/` (relative URL, goes through ClawHost proxy)
- JSON-RPC protocol for keepalive (`sessions.list` with limit 1)
- Keepalive interval: 25s, timeout: 10s
- Auto-reconnect with exponential backoff (800ms to 15s)
- `onConnected` / `onDisconnected` callbacks

### 2. useGatewayConnection Hook

Location: `portal/src/hooks/use-gateway-connection.ts`

```typescript
interface UseGatewayConnectionOptions {
  agentId: string;
  enabled: boolean; // only when agent is running
}

interface GatewayConnectionState {
  connectionState: "connecting" | "connected" | "disconnected";
  client: GatewayClient | null;
}
```

### 3. ChatPanel Enhancement

Location: `portal/src/components/chat-panel.tsx`

Add status indicator in footer area:
- Status dot with color based on state
- Text: "已连接" / "连接中..." / "未连接"
- When disconnected, show toast on send attempt

## States

| State | Color | Behavior |
|-------|-------|----------|
| `connecting` | Yellow, pulsing | Initial connection or reconnecting |
| `connected` | Green | Normal operation, can send messages |
| `disconnected` | Red | Gateway unreachable after max retries |

## Integration Points

1. **ChatPanel** - Subscribe to connection state, show indicator
2. **useAgentStatus** - Enable connection only when agent status is "running"
3. **chat API route** - Already returns 503 when agent not available

## Avoiding Duplicate Code

ClawHost backend already has:
- `service/k8s/gateway.go` - `GatewayClient` for backend WebSocket (used for device management)
- `handler/proxy/proxy.go` - WebSocket proxy for browser connections

Frontend will have its own simplified `GatewayClient` because:
1. Browser WebSocket API differs from Go's gorilla/websocket
2. Frontend needs React integration (hooks, state updates)
3. Different auth flow (session cookie vs token)

The frontend client is intentionally simple - only connection monitoring, no RPC methods needed.

## Files to Create/Modify

### Create
- `portal/src/lib/gateway-client.ts` - WebSocket client class
- `portal/src/hooks/use-gateway-connection.ts` - React hook

### Modify
- `portal/src/components/chat-panel.tsx` - Add status indicator UI
- `portal/src/app/globals.css` - Add status dot styles
- `portal/src/messages/zh.json` - Add Chinese translations
- `portal/src/messages/en.json` - Add English translations

## Testing

1. Start agent, verify "已连接" shows
2. Stop agent (or delete pod), verify transitions to "未连接"
3. Restart agent, verify auto-reconnect to "已连接"
4. Try sending message when disconnected, see error toast