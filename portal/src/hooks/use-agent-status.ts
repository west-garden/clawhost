import { useEffect, useRef } from "react";
import useSWR from "swr";
import type { AgentStatusResponse, ApiResponse } from "@/types";

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json()) as Promise<ApiResponse<AgentStatusResponse>>;

export function useAgentStatus(agentId: string, enabled = true) {
  const stableTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { data, error, isLoading, mutate } = useSWR(
    enabled ? `/api/agents/${agentId}/status` : null,
    fetcher,
    {
      // Poll every 5s (simple, reliable)
      refreshInterval: enabled ? 5000 : 0,
      revalidateOnReconnect: true,
    }
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (stableTimerRef.current) {
        clearTimeout(stableTimerRef.current);
      }
    };
  }, []);

  return {
    status: data?.data,
    error,
    isLoading,
    mutate,
  };
}
