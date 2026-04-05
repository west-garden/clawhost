"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WechatQrDialog } from "./wechat-qr-dialog";
import { TelegramDialog } from "./telegram-dialog";
import { ChannelPairingPanel } from "./channel-pairing-panel";
import { ConfirmDialog } from "./confirm-dialog";
import { removeChannel } from "@/lib/actions";
import type { AgentStatus, ApiResponse } from "@/types";

const channelNames: Record<string, string> = {
  telegram: "Telegram",
  "openclaw-weixin": "WeChat",
  wechat: "WeChat",
  discord: "Discord",
  slack: "Slack",
  feishu: "飞书",
  signal: "Signal",
  matrix: "Matrix",
  line: "LINE",
  msteams: "MS Teams",
  mattermost: "Mattermost",
};

// Channels that support pairing-based DM access
const PAIRING_CHANNELS = new Set(["telegram", "discord", "signal", "slack", "msteams"]);

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
  const [detailChannel, setDetailChannel] = useState<string | null>(null);
  const [detailLabel, setDetailLabel] = useState("");

  const isRunning = agentStatus === "running";

  const { data, mutate } = useSWR<ApiResponse<Record<string, unknown>>>(
    isRunning ? `/api/agents/${agentId}/channels` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const channels = data?.data ? Object.entries(data.data) : [];

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

  function openDetail(channel: string, label: string) {
    setDetailChannel(channel);
    setDetailLabel(label);
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
              {channels.map(([ch, info]) => {
                const chInfo = info as Record<string, unknown>;
                const enabled = chInfo?.enabled !== false;
                const accounts = (chInfo?.accounts as string[]) || [];
                const label = channelNames[ch] || ch;
                const supportsPairing = PAIRING_CHANNELS.has(ch);

                return (
                  <div
                    key={ch}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div
                      className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                      onClick={() => openDetail(ch, label)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{label}</span>
                          <Badge
                            variant={enabled ? "secondary" : "destructive"}
                            className="text-xs"
                          >
                            {enabled ? t("channels.channelDetails.enabled") : t("channels.channelDetails.disabled")}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {accounts.length > 0
                            ? `${accounts.length} ${t("channels.channelDetails.accounts")}: ${accounts.join(", ")}`
                            : ch}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {supportsPairing && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openDetail(ch, label)}
                        >
                          {t("channels.channelDetails.managePairing")}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => setRemoveTarget(ch)}
                      >
                        {t("channels.remove")}
                      </Button>
                    </div>
                  </div>
                );
              })}
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

      {/* Channel detail dialog */}
      <Dialog
        open={detailChannel !== null}
        onOpenChange={(v) => !v && setDetailChannel(null)}
      >
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailLabel}</DialogTitle>
          </DialogHeader>
          {detailChannel && (
            <Tabs defaultValue="details">
              <TabsList className="w-full">
                <TabsTrigger value="details" className="flex-1">
                  {t("channels.channelDetails.title")}
                </TabsTrigger>
                {PAIRING_CHANNELS.has(detailChannel) && (
                  <TabsTrigger value="pairing" className="flex-1">
                    {t("channels.pairing.title")}
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="details" className="pt-3">
                {(() => {
                  const chData = data?.data?.[detailChannel] as Record<string, unknown> | undefined;
                  const enabled = chData?.enabled !== false;
                  const accounts = (chData?.accounts as string[]) || [];
                  const dmPolicy = chData?.dmPolicy as string | undefined;
                  const groupPolicy = chData?.groupPolicy as string | undefined;

                  return (
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">{t("channels.channelDetails.status")}</span>
                        <Badge variant={enabled ? "secondary" : "destructive"}>
                          {enabled ? t("channels.channelDetails.enabled") : t("channels.channelDetails.disabled")}
                        </Badge>
                      </div>
                      {accounts.length > 0 && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-muted-foreground">{t("channels.channelDetails.accounts")}</span>
                          <span className="font-mono">{accounts.join(", ")}</span>
                        </div>
                      )}
                      {dmPolicy && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-muted-foreground">{t("channels.channelDetails.dmPolicy")}</span>
                          <span className="font-mono">{dmPolicy}</span>
                        </div>
                      )}
                      {groupPolicy && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-muted-foreground">{t("channels.channelDetails.groupPolicy")}</span>
                          <span className="font-mono">{groupPolicy}</span>
                        </div>
                      )}
                      <div className="pt-2 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => {
                            setDetailChannel(null);
                            setRemoveTarget(detailChannel);
                          }}
                        >
                          {t("channels.remove")}
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </TabsContent>

              {PAIRING_CHANNELS.has(detailChannel) && (
                <TabsContent value="pairing" className="pt-3">
                  <ChannelPairingPanel
                    agentId={agentId}
                    channel={detailChannel}
                    channelLabel={detailLabel}
                    isRunning={isRunning}
                  />
                </TabsContent>
              )}
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

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
