"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AgentStatus } from "@/types";

const statusConfig: Record<AgentStatus, { color: string; dot: string }> = {
  created: {
    color: "bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300",
    dot: "bg-gray-400 dark:bg-gray-500",
  },
  starting: {
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    dot: "bg-blue-500 dark:bg-blue-400",
  },
  running: {
    color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    dot: "bg-green-500 dark:bg-green-400",
  },
  stopped: {
    color: "bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300",
    dot: "bg-gray-400 dark:bg-gray-500",
  },
  error: {
    color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    dot: "bg-red-500 dark:bg-red-400",
  },
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
