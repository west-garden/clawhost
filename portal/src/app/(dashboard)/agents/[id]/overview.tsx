"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { AgentStatusBadge } from "@/components/agent-status-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ChannelList } from "@/components/channel-list";
import { ConfigModelsPanel } from "@/components/config-models-panel";
import { ConfigDefaultsPanel } from "@/components/config-defaults-panel";
import { useAgent } from "@/contexts/agent-context";
import {
  startAgent,
  stopAgent,
  restartAgent,
  deleteAgent,
  resetAgentToken,
  listModelProviders,
} from "@/lib/actions";
import type { AgentConnectResponse } from "@/types";

export function AgentOverview({
  connectInfo,
}: {
  connectInfo: AgentConnectResponse | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetTokenOpen, setResetTokenOpen] = useState(false);

  const { agent, currentStatus } = useAgent();

  // Config tab state
  const [configProviders, setConfigProviders] = useState<Record<string, { baseUrl?: string; apiKey?: string; apiType?: string; models?: Array<{ id: string; name?: string }> }>>({});
  const [configLoading, setConfigLoading] = useState(false);

  async function fetchConfigProviders() {
    setConfigLoading(true);
    const result = await listModelProviders(agent.id);
    if (!result.error && result.providers) {
      setConfigProviders(result.providers);
    }
    setConfigLoading(false);
  }

  async function handleAction(
    action: "start" | "stop" | "restart",
    fn: (id: string) => Promise<{ error?: string; success?: boolean }>
  ) {
    setActionLoading(action);
    const result = await fn(agent.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t(`agent.${action}Success`));
      router.refresh();
    }
    setActionLoading(null);
  }

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
    // Try modern API first (requires HTTPS or localhost)
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text);
    } else {
      // Fallback for non-secure contexts (IP address access)
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    toast.success(t("common.copied"));
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← {t("common.back")}
        </Link>
        <h1 className="text-2xl font-semibold">{agent.name}</h1>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("agent.overview")}</TabsTrigger>
          <TabsTrigger value="config">{t("agent.config.title")}</TabsTrigger>
          <TabsTrigger value="channels">{t("agent.channels")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Status + Actions */}
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <AgentStatusBadge status={currentStatus} />
              <div className="flex gap-2">
                {currentStatus !== "running" && (
                  <Button
                    size="sm"
                    onClick={() => handleAction("start", startAgent)}
                    disabled={actionLoading !== null}
                  >
                    {actionLoading === "start"
                      ? t("agent.actions.starting")
                      : t("agent.actions.start")}
                  </Button>
                )}
                {currentStatus === "running" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction("restart", restartAgent)}
                      disabled={actionLoading !== null}
                    >
                      {actionLoading === "restart"
                        ? t("agent.actions.restarting")
                        : t("agent.actions.restart")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction("stop", stopAgent)}
                      disabled={actionLoading !== null}
                    >
                      {actionLoading === "stop"
                        ? t("agent.actions.stopping")
                        : t("agent.actions.stop")}
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Connection info (only when running) */}
          {connectInfo && currentStatus === "running" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("agent.connect.webui")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {connectInfo.webchat_url && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {t("agent.connect.webui")}
                      </p>
                      <p className="text-sm text-muted-foreground truncate max-w-md">
                        {connectInfo.webchat_url}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        window.open(connectInfo.webchat_url, "_blank")
                      }
                    >
                      {t("common.open")}
                    </Button>
                  </div>
                )}

                <Separator />

                {connectInfo.endpoint && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {t("agent.connect.apiEndpoint")}
                      </p>
                      <p className="text-sm text-muted-foreground truncate max-w-md">
                        {connectInfo.endpoint}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(connectInfo.endpoint!)}
                    >
                      {t("common.copy")}
                    </Button>
                  </div>
                )}

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {t("agent.connect.accessToken")}
                    </p>
                    <p className="text-sm text-muted-foreground font-mono">
                      {agent.access_token.slice(0, 8)}••••••••
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(agent.access_token)}
                    >
                      {t("common.copy")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setResetTokenOpen(true)}
                    >
                      {t("agent.connect.resetToken")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          <Card>
            <CardContent className="p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("agent.info.slug")}
                </span>
                <span className="font-mono">{agent.slug}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("agent.info.createdAt")}
                </span>
                <span>
                  {new Date(agent.created_at).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Danger zone */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-base text-red-600">
                {t("agent.danger.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                {t("agent.danger.deleteAgent")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-4 mt-4">
          <Tabs defaultValue="defaults">
            <TabsList>
              <TabsTrigger value="defaults">{t("agent.config.defaults")}</TabsTrigger>
              <TabsTrigger value="models">{t("agent.config.models")}</TabsTrigger>
            </TabsList>
            <TabsContent value="defaults" className="mt-4">
              <ConfigDefaultsPanel agentId={agent.id} />
            </TabsContent>
            <TabsContent value="models" className="mt-4">
              <ConfigModelsPanel
                agentId={agent.id}
                providers={configProviders}
                loading={configLoading}
                onRefresh={fetchConfigProviders}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="channels" className="mt-4">
          <ChannelList agentId={agent.id} agentStatus={currentStatus} />
        </TabsContent>
      </Tabs>

      {/* Reset token confirmation */}
      <ConfirmDialog
        open={resetTokenOpen}
        onOpenChange={setResetTokenOpen}
        title={t("agent.connect.resetToken")}
        description={t("agent.connect.resetTokenConfirm")}
        loading={actionLoading === "resetToken"}
        onConfirm={handleResetToken}
      />

      {/* Delete confirmation */}
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
