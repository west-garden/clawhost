"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WechatQrDialog } from "./wechat-qr-dialog";
import { TelegramDialog } from "./telegram-dialog";
import { ConfirmDialog } from "./confirm-dialog";
import { removeChannel } from "@/lib/actions";
import type { AgentStatus, ApiResponse } from "@/types";

const channelNames: Record<string, string> = {
  telegram: "Telegram",
  "openclaw-weixin": "WeChat",
  wechat: "WeChat",
  discord: "Discord",
  slack: "Slack",
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function ChannelList({
  agentId,
  agentStatus,
}: {
  agentId: string;
  agentStatus: AgentStatus;
}) {
  const t = useTranslations();
  const [wechatOpen, setWechatOpen] = useState(false);
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  const isRunning = agentStatus === "running";

  const { data, mutate } = useSWR<ApiResponse<Record<string, unknown>>>(
    isRunning ? `/api/agents/${agentId}/channels` : null,
    fetcher,
    { refreshInterval: 10000 }
  );

  const channels = data?.data ? Object.keys(data.data) : [];

  const handleChannelAdded = useCallback(() => {
    mutate();
  }, [mutate]);

  async function handleRemove() {
    if (!removeTarget) return;
    setRemoveLoading(true);
    const result = await removeChannel(agentId, removeTarget);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("channels.removed"));
      mutate();
    }
    setRemoveTarget(null);
    setRemoveLoading(false);
  }

  if (!isRunning) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          {t("agent.notRunning")}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connected channels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("channels.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("channels.empty")}
            </p>
          ) : (
            <div className="space-y-3">
              {channels.map((ch) => (
                <div
                  key={ch}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm">
                      {channelNames[ch] || ch}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {ch}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => setRemoveTarget(ch)}
                  >
                    {t("channels.remove")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add channel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("channels.add")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setWechatOpen(true)}
            >
              <CardContent className="p-4 text-center">
                <p className="font-medium text-sm">
                  {t("channels.wechat.name")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("channels.wechat.scanQr")}
                </p>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setTelegramOpen(true)}
            >
              <CardContent className="p-4 text-center">
                <p className="font-medium text-sm">
                  {t("channels.telegram.name")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("channels.telegram.botToken")}
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <WechatQrDialog
        open={wechatOpen}
        onOpenChange={setWechatOpen}
        agentId={agentId}
        onSuccess={handleChannelAdded}
      />
      <TelegramDialog
        open={telegramOpen}
        onOpenChange={setTelegramOpen}
        agentId={agentId}
        onSuccess={handleChannelAdded}
      />
      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(v) => !v && setRemoveTarget(null)}
        title={t("channels.remove")}
        description={t("channels.removeConfirm")}
        variant="destructive"
        loading={removeLoading}
        onConfirm={handleRemove}
      />
    </div>
  );
}
