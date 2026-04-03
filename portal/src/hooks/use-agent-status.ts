import useSWR from "swr";
import type { AgentStatusResponse, ApiResponse } from "@/types";

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json()) as Promise<ApiResponse<AgentStatusResponse>>;

export function useAgentStatus(agentId: string, enabled = true) {
  const { data, error, isLoading, mutate } = useSWR(
    enabled ? `/api/agents/${agentId}/status` : null,
    fetcher,
    {
      refreshInterval: enabled ? 5000 : 0,
      revalidateOnReconnect: true,
    }
  );

  return {
    status: data?.data,
    error,
    isLoading,
    mutate,
  };
}
