"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfirmDialog } from "./confirm-dialog";
import { ChannelList } from "./channel-list";
import { useAgentStatus } from "@/hooks/use-agent-status";
import { deleteAgent, resetAgentToken, resetAgent } from "@/lib/actions";
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
  const [resetOpen, setResetOpen] = useState(false);

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

  async function handleReset() {
    setActionLoading("reset");
    const result = await resetAgent(agent.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("agent.resetSuccess"));
      router.refresh();
    }
    setResetOpen(false);
    setActionLoading(null);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success(t("common.copied"));
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-6">
      {/* Toolbox Section */}
      <section className="glass-panel">
        <div className="glass-panel-header">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-primary" />
            <span className="font-semibold text-foreground">
              {t("agent.toolbox")}
            </span>
          </div>
        </div>
        <div className="glass-panel-content">
          <button
            onClick={() => setResetOpen(true)}
            className="w-full flex items-center gap-4 p-4 rounded-xl bg-muted/30 hover:bg-muted/60 active:bg-muted active:scale-[0.99] transition-all duration-150 text-left min-h-[56px]"
          >
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <RotateCcw className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-medium text-foreground">
                {t("agent.resetAgent") || "Reset Agent"}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t("agent.resetAgentDesc") || "Restore to initial state, clear runtime config (model config preserved)"}
              </p>
            </div>
          </button>
        </div>
      </section>

      {/* Connection Info */}
      {currentStatus === "running" && (
        <section className="glass-panel">
          <div className="glass-panel-header">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-primary" />
              <span className="font-semibold text-foreground">
                {t("agent.connect.webui")}
              </span>
            </div>
          </div>
          <div className="glass-panel-content space-y-4">
            {!connectInfo || !connectInfo.webchat_url ? (
              <div className="flex items-center gap-3 text-muted-foreground py-2">
                <div className="animate-spin w-5 h-5 border-2 border-current border-t-transparent rounded-full" />
                <span className="text-base">{t("agent.connect.webuiLoading")}</span>
              </div>
            ) : (
              <>
                {/* WebUI Section */}
                <div className="flex items-start justify-between gap-4 py-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      WebUI
                    </p>
                    <p className="text-base text-foreground truncate font-mono break-all">
                      {connectInfo.webchat_url}
                    </p>
                    <p className="text-sm text-yellow-600 dark:text-yellow-500 mt-1.5">
                      {t("agent.connect.webuiHint")}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      window.open(connectInfo.webchat_url, "_blank")
                    }
                    className="glass-btn-secondary shrink-0 min-h-[44px] min-w-[44px] px-4 py-2.5 text-sm active:scale-95 transition-transform duration-150"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>{t("common.open")}</span>
                  </button>
                </div>

                <div className="h-px bg-border" />

                {/* Access Token Section */}
                <div className="flex items-start justify-between gap-4 py-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      {t("agent.connect.accessToken")}
                    </p>
                    <p className="text-base text-foreground font-mono">
                      {agent.access_token.slice(0, 8)}••••••••
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => copyToClipboard(agent.access_token)}
                      className="glass-btn-secondary min-h-[44px] min-w-[44px] px-3 py-2.5 text-sm active:scale-95 transition-transform duration-150"
                      title={t("common.copy")}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setResetTokenOpen(true)}
                      className="glass-btn-secondary min-h-[44px] min-w-[44px] px-3 py-2.5 text-sm active:scale-95 transition-transform duration-150"
                      title={t("agent.connect.resetToken")}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* Channels */}
      <ChannelList agentId={agent.id} agentStatus={currentStatus} />

      {/* Danger Zone */}
      <section className="glass-panel border-2 border-destructive/30">
        <div className="glass-panel-header bg-destructive/5 border-b border-destructive/20">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <span className="font-semibold text-destructive">
              {t("agent.danger.title")}
            </span>
          </div>
        </div>
        <div className="glass-panel-content bg-destructive/[0.02]">
          <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/15">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-destructive">
                  {t("agent.danger.deleteAgent")}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("agent.danger.deleteDesc") || "Permanently delete this Agent and all its data. This action cannot be undone."}
                </p>
              </div>
            </div>
            <button
              onClick={() => setDeleteOpen(true)}
              className="mt-4 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 text-base font-semibold text-white bg-destructive rounded-xl hover:bg-destructive/90 active:scale-[0.98] transition-all duration-150 min-h-[48px] shadow-sm"
            >
              <Trash2 className="w-4 h-4" />
              <span>{t("common.delete")}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Dialogs */}
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title={t("agent.resetAgent") || "Reset Agent"}
        description={t("agent.resetAgentConfirm") || "Are you sure you want to reset this Agent? This will clear runtime configuration (WeChat binding, scheduled tasks, etc.) and restore to initial state. Model configuration will be preserved."}
        loading={actionLoading === "reset"}
        onConfirm={handleReset}
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