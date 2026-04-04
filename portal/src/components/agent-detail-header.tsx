"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { AgentStatusBadge } from "./agent-status-badge";
import type { AgentStatus } from "@/types";
import { Square, RotateCw, Play, ExternalLink } from "lucide-react";

interface AgentDetailHeaderProps {
  agentId: string;
  agentName: string;
  agentSlug: string;
  currentStatus: AgentStatus;
  webchatUrl?: string;
  actionLoading: string | null;
  onAction: (action: "start" | "stop" | "restart") => void;
}

export function AgentDetailHeader({
  agentId,
  agentName,
  agentSlug,
  currentStatus,
  webchatUrl,
  actionLoading,
  onAction,
}: AgentDetailHeaderProps) {
  const t = useTranslations();
  const pathname = usePathname();

  const initial = (agentName || "?")[0].toUpperCase();
  const isChatTab = pathname.endsWith("/chat");

  return (
    <div className="agent-detail-header">
      {/* Agent info row */}
      <div className="px-5 pt-4 pb-2 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-base font-bold text-white flex-shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-base font-semibold text-foreground truncate">
              {agentName}
            </h1>
            <AgentStatusBadge status={currentStatus} />
          </div>
          <p className="text-sm text-muted-foreground font-mono truncate mt-0.5">
            {agentSlug} · ID: {agentId.slice(0, 12)}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-shrink-0 flex-wrap sm:flex-nowrap">
          {currentStatus !== "running" && currentStatus !== "starting" && (
            <button
              onClick={() => onAction("start")}
              disabled={actionLoading !== null}
              className="glass-btn h-11 py-2.5 px-4 text-sm min-w-[80px]"
            >
              <Play className="w-4 h-4" />
              <span>
                {actionLoading === "start"
                  ? t("agent.actions.starting")
                  : t("agent.actions.start")}
              </span>
            </button>
          )}
          {currentStatus === "running" && (
            <>
              <button
                onClick={() => onAction("stop")}
                disabled={actionLoading !== null}
                className="glass-btn-secondary h-11 py-2.5 px-4 text-sm min-w-[80px]"
              >
                <Square className="w-4 h-4" />
                <span>
                  {actionLoading === "stop"
                    ? t("agent.actions.stopping")
                    : t("agent.actions.stop")}
                </span>
              </button>
              <button
                onClick={() => onAction("restart")}
                disabled={actionLoading !== null}
                className="glass-btn-secondary h-11 py-2.5 px-4 text-sm min-w-[90px]"
              >
                <RotateCw className="w-4 h-4" />
                <span>
                  {actionLoading === "restart"
                    ? t("agent.actions.restarting")
                    : t("agent.actions.restart")}
                </span>
              </button>
            </>
          )}
          {webchatUrl && (
            <a
              href={webchatUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-btn-secondary h-11 py-2.5 px-4 text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">WebUI</span>
            </a>
          )}
        </div>
      </div>

      {/* View tabs with proper touch targets */}
      <div className="flex gap-0 px-5 mt-2 overflow-x-auto scrollbar-none">
        <Link
          href={`/agents/${agentId}`}
          className={cn(
            "view-tab",
            pathname === `/agents/${agentId}` && "view-tab-active"
          )}
        >
          {t("agent.management")}
        </Link>
        <Link
          href={`/agents/${agentId}/config`}
          className={cn(
            "view-tab",
            pathname.includes("/config") && "view-tab-active"
          )}
        >
          {t("agent.config.title")}
        </Link>
        <Link
          href={`/agents/${agentId}/skills`}
          className={cn(
            "view-tab",
            pathname.includes("/skills") && "view-tab-active"
          )}
        >
          {t("agent.skills.title")}
        </Link>
        <Link
          href={`/agents/${agentId}/tasks`}
          className={cn(
            "view-tab",
            pathname.includes("/tasks") && "view-tab-active"
          )}
        >
          {t("agent.tasks.title")}
        </Link>
        <Link
          href={`/agents/${agentId}/devices`}
          className={cn(
            "view-tab",
            pathname.includes("/devices") && "view-tab-active"
          )}
        >
          {t("agent.devices.title")}
        </Link>
        <Link
          href={`/agents/${agentId}/chat`}
          className={cn(
            "view-tab",
            isChatTab && "view-tab-active"
          )}
        >
          {t("agent.chat")}
        </Link>
      </div>
    </div>
  );
}
