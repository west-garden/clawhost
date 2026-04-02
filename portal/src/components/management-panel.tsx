"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfirmDialog } from "./confirm-dialog";
import { ChannelList } from "./channel-list";
import { useAgentStatus } from "@/hooks/use-agent-status";
import { deleteAgent, resetAgentToken } from "@/lib/actions";
import type { AgentDetail, AgentConnectResponse } from "@/types";
import {
  Copy,
  RefreshCw,
  ExternalLink,
  Trash2,
  AlertTriangle,
  Link2,
  RotateCcw,
} from "lucide-react";

export function ManagementPanel({
  agent,
  connectInfo,
}: {
  agent: AgentDetail;
  connectInfo: AgentConnectResponse | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetTokenOpen, setResetTokenOpen] = useState(false);

  const { status: liveStatus } = useAgentStatus(agent.id, true);
  const currentStatus = liveStatus?.status ?? agent.status;

  async function handleDelete() {
    setActionLoading("delete");
    const result = await deleteAgent(agent.id);
    if (result?.error) {
      toast.error(result.error);
      setActionLoading(null);
    } else {
      toast.success(t("agent.danger.deleted"));
      router.push("/");
    }
  }

  async function handleResetToken() {
    setActionLoading("resetToken");
    const result = await resetAgentToken(agent.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("agent.connect.tokenReset"));
      router.refresh();
    }
    setResetTokenOpen(false);
    setActionLoading(null);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success(t("common.copied"));
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      {/* Toolbox */}
      <div className="glass-panel">
        <div className="glass-panel-header">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-red-400" />
            <span className="font-medium text-white text-sm">
              {t("agent.toolbox")}
            </span>
          </div>
        </div>
        <div className="glass-panel-content">
          <button className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] hover:bg-white/5 transition-colors text-left">
            <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
              <RotateCcw className="w-4 h-4 text-white/50" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">重置 Agent</p>
              <p className="text-xs text-white/40">
                强制重启 Agent，清除所有运行状态
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Connection Info */}
      {connectInfo && currentStatus === "running" && (
        <div className="glass-panel">
          <div className="glass-panel-header">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-red-400" />
              <span className="font-medium text-white text-sm">
                {t("agent.connect.webui")}
              </span>
            </div>
          </div>
          <div className="glass-panel-content space-y-3">
            {connectInfo.webchat_url && (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white/60 uppercase tracking-wider mb-1">
                    WebUI
                  </p>
                  <p className="text-xs text-white/40 truncate font-mono">
                    {connectInfo.webchat_url}
                  </p>
                </div>
                <button
                  onClick={() =>
                    window.open(connectInfo.webchat_url, "_blank")
                  }
                  className="glass-btn-secondary py-1.5 px-3 text-xs shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{t("common.open")}</span>
                </button>
              </div>
            )}

            <div className="h-px bg-white/5" />

            {connectInfo.endpoint && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white/60 uppercase tracking-wider mb-1">
                      {t("agent.connect.apiEndpoint")}
                    </p>
                    <p className="text-xs text-white/40 truncate font-mono">
                      {connectInfo.endpoint}
                    </p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(connectInfo.endpoint!)}
                    className="glass-btn-secondary py-1.5 px-3 text-xs shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{t("common.copy")}</span>
                  </button>
                </div>
                <div className="h-px bg-white/5" />
              </>
            )}

            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-white/60 uppercase tracking-wider mb-1">
                  {t("agent.connect.accessToken")}
                </p>
                <p className="text-xs text-white/40 font-mono">
                  {agent.access_token.slice(0, 8)}••••••••
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => copyToClipboard(agent.access_token)}
                  className="glass-btn-secondary py-1.5 px-3 text-xs"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setResetTokenOpen(true)}
                  className="glass-btn-secondary py-1.5 px-3 text-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Channels */}
      <ChannelList agentId={agent.id} agentStatus={currentStatus} />

      {/* Danger Zone */}
      <div className="glass-panel border-red-500/20">
        <div className="glass-panel-header border-b-red-500/10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="font-medium text-red-400 text-sm">
              {t("agent.danger.title")}
            </span>
          </div>
        </div>
        <div className="glass-panel-content">
          <button
            onClick={() => setDeleteOpen(true)}
            className="flex items-center gap-3 p-3 rounded-lg border border-red-500/15 hover:bg-red-500/5 transition-colors w-full text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-red-400">
                {t("agent.danger.deleteAgent")}
              </p>
              <p className="text-xs text-white/40">
                永久删除此 Agent 及其所有数据，此操作不可撤销
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Dialogs */}
      <ConfirmDialog
        open={resetTokenOpen}
        onOpenChange={setResetTokenOpen}
        title={t("agent.connect.resetToken")}
        description={t("agent.connect.resetTokenConfirm")}
        loading={actionLoading === "resetToken"}
        onConfirm={handleResetToken}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("agent.danger.deleteAgent")}
        description={t("agent.danger.deleteConfirm", { name: agent.name })}
        requireInput={agent.name}
        inputPlaceholder={t("agent.danger.deleteConfirmPlaceholder")}
        variant="destructive"
        confirmText={t("common.delete")}
        loading={actionLoading === "delete"}
        onConfirm={handleDelete}
      />
    </div>
  );
}
