"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AgentStatus } from "@/types";

const statusConfig: Record<AgentStatus, { color: string; dot: string }> = {
  created: { color: "bg-gray-100 text-gray-700", dot: "bg-gray-400" },
  starting: { color: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  running: { color: "bg-green-100 text-green-700", dot: "bg-green-500" },
  stopped: { color: "bg-gray-100 text-gray-700", dot: "bg-gray-400" },
  error: { color: "bg-red-100 text-red-700", dot: "bg-red-500" },
};

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const t = useTranslations("agent.status");
  const config = statusConfig[status] || statusConfig.created;

  return (
    <Badge variant="secondary" className={cn("gap-1.5", config.color)}>
      <span className={cn("h-2 w-2 rounded-full", config.dot)} />
      {t(status)}
    </Badge>
  );
}
