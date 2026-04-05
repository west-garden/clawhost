import { useEffect, useRef } from "react";
import useSWR from "swr";
import type { AgentStatusResponse, ApiResponse } from "@/types";

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json()) as Promise<ApiResponse<AgentStatusResponse>>;

interface UseAgentStatusOptions {
  enabled?: boolean;
  pauseWhen?: boolean; // Pause polling when this condition is true (e.g., WebSocket connected)
}

export function useAgentStatus(agentId: string, options?: UseAgentStatusOptions | boolean) {
  // Support legacy boolean argument for backwards compatibility
  const enabled = typeof options === "boolean" ? options : options?.enabled ?? true;
  const pauseWhen = typeof options === "boolean" ? false : options?.pauseWhen ?? false;

  const { data, error, isLoading, mutate } = useSWR(
    enabled ? `/api/agents/${agentId}/status` : null,
    fetcher,
    {
      // Poll every 30s, but pause when pauseWhen is true (e.g., WebSocket connected)
      refreshInterval: enabled && !pauseWhen ? 30000 : 0,
      revalidateOnReconnect: !pauseWhen,
      revalidateOnFocus: !pauseWhen,
      revalidateIfStale: !pauseWhen,
    }
  );

  return {
    status: data?.data,
    error,
    isLoading,
    mutate,
  };
}
