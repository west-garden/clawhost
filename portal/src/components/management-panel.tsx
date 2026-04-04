"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfirmDialog } from "./confirm-dialog";
import { ChannelList } from "./channel-list";
import { useAgentStatus } from "@/hooks/use-agent-status";
import { deleteAgent, resetAgentToken, restartAgent } from "@/lib/actions";
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
  const [restartOpen, setRestartOpen] = useState(false);

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

  async function handleRestart() {
    setActionLoading("restart");
    const result = await restartAgent(agent.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("agent.restartSuccess"));
      router.refresh();
    }
    setRestartOpen(false);
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
            <RotateCcw className="w-4 h-4 text-red-500" />
            <span className="font-medium text-foreground text-sm">
              {t("agent.toolbox")}
            </span>
          </div>
        </div>
        <div className="glass-panel-content">
          <button
            onClick={() => setRestartOpen(true)}
            className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
              <RotateCcw className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">重置 Agent</p>
              <p className="text-xs text-muted-foreground">
                强制重启 Agent，清除所有运行状态
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Connection Info */}
      {currentStatus === "running" && (
        <div className="glass-panel">
          <div className="glass-panel-header">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-red-500" />
              <span className="font-medium text-foreground text-sm">
                {t("agent.connect.webui")}
              </span>
            </div>
          </div>
          <div className="glass-panel-content space-y-3">
            {!connectInfo || !connectInfo.webchat_url ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                <span className="text-xs">{t("agent.connect.webuiLoading")}</span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      WebUI
                    </p>
                    <p className="text-xs text-muted-foreground truncate font-mono">
                      {connectInfo.webchat_url}
                    </p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                      {t("agent.connect.webuiHint")}
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

                <div className="h-px bg-border" />

                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      {t("agent.connect.accessToken")}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
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
              </>
            )}
          </div>
        </div>
      )}

      {/* Channels */}
      <ChannelList agentId={agent.id} agentStatus={currentStatus} />

      {/* Danger Zone */}
      <div className="glass-panel border-red-500/20">
        <div className="glass-panel-header border-b-red-500/10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="font-medium text-red-500 text-sm">
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
              <Trash2 className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-red-500">
                {t("agent.danger.deleteAgent")}
              </p>
              <p className="text-xs text-muted-foreground">
                永久删除此 Agent 及其所有数据，此操作不可撤销
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Dialogs */}
      <ConfirmDialog
        open={restartOpen}
        onOpenChange={setRestartOpen}
        title="重置 Agent"
        description="确定要重置此 Agent 吗？这将强制重启并清除所有运行状态。"
        loading={actionLoading === "restart"}
        onConfirm={handleRestart}
      />
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
