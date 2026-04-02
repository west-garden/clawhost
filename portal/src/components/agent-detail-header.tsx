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
      <div className="px-5 pt-4 pb-0 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-base font-semibold text-white truncate">
              {agentName}
            </h1>
            <AgentStatusBadge status={currentStatus} />
          </div>
          <p className="text-[11px] text-white/30 font-mono truncate">
            {agentSlug} · ID: {agentId.slice(0, 12)}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-1.5 flex-shrink-0">
          {currentStatus !== "running" && currentStatus !== "starting" && (
            <button
              onClick={() => onAction("start")}
              disabled={actionLoading !== null}
              className="glass-btn py-1.5 px-3 text-xs"
            >
              <Play className="w-3.5 h-3.5" />
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
                className="glass-btn-secondary py-1.5 px-3 text-xs"
              >
                <Square className="w-3 h-3" />
                <span>
                  {actionLoading === "stop"
                    ? t("agent.actions.stopping")
                    : t("agent.actions.stop")}
                </span>
              </button>
              <button
                onClick={() => onAction("restart")}
                disabled={actionLoading !== null}
                className="glass-btn-secondary py-1.5 px-3 text-xs"
              >
                <RotateCw className="w-3 h-3" />
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
              className="glass-btn-secondary py-1.5 px-3 text-xs"
            >
              <ExternalLink className="w-3 h-3" />
              <span>WebUI</span>
            </a>
          )}
        </div>
      </div>

      {/* View tabs */}
      <div className="flex gap-0 px-5 mt-3">
        <Link
          href={`/agents/${agentId}`}
          className={cn(
            "view-tab",
            !isChatTab && "view-tab-active"
          )}
        >
          {t("agent.management")}
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
