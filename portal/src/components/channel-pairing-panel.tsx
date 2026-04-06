"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import {
  approveChannelPairing,
  revokeChannelPairing,
  listChannelPairingRequests,
  listChannelPairedUsers,
} from "@/lib/actions";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  agentId: string;
  channel: string;
  channelLabel: string;
  isRunning: boolean;
}

export function ChannelPairingPanel({ agentId, channel, channelLabel, isRunning }: Props) {
  const t = useTranslations("channels.pairing");
  const tAgent = useTranslations("agent");
  const [approveCode, setApproveCode] = useState("");
  const [approving, setApproving] = useState(false);
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null);

  // Pending pairing requests
  const { data: pendingData, mutate: mutatePending, isLoading: pendingLoading } = useSWR(
    isRunning ? `/api/agents/${agentId}/channels/${channel}/pairing` : null,
    fetcher,
    { refreshInterval: 15000 }
  );
  const pendingRequests = pendingData?.data?.requests || [];

  // Paired users
  const { data: pairedData, mutate: mutatePaired, isLoading: pairedLoading } = useSWR(
    isRunning ? `/api/agents/${agentId}/channels/${channel}/pairing/users` : null,
    fetcher,
    { refreshInterval: 30000 }
  );
  const pairedUsers = pairedData?.data?.users || [];

  async function handleApprove() {
    if (!approveCode.trim()) return;
    setApproving(true);
    const result = await approveChannelPairing(agentId, channel, approveCode.trim());
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("approved"));
      setApproveCode("");
      mutatePending();
    }
    setApproving(false);
  }

  async function handleRevoke(userId: string) {
    setRevokingUserId(userId);
    const result = await revokeChannelPairing(agentId, channel, userId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("revoked"));
      mutatePaired();
    }
    setRevokingUserId(null);
  }

  if (!isRunning) {
    return (
      <div className="text-center text-muted-foreground text-sm py-8">
        {tAgent("notRunning")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Approve code input */}
      <div className="space-y-2">
        <Label>{t("approveCode")}</Label>
        <div className="flex gap-2">
          <Input
            value={approveCode}
            onChange={(e) => setApproveCode(e.target.value.toUpperCase())}
            placeholder={t("codePlaceholder")}
            className="uppercase tracking-widest font-mono"
            onKeyDown={(e) => e.key === "Enter" && handleApprove()}
          />
          <Button
            onClick={handleApprove}
            disabled={approving || !approveCode.trim()}
          >
            {approving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              t("approve")
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            {t("pendingTitle")}
            {pendingRequests.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="paired">
            {t("pairedTitle")}
            <Badge variant="secondary" className="ml-1.5 text-xs">
              {pairedUsers.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-2 pt-2">
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => mutatePending()}
              disabled={pendingLoading}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${pendingLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {pendingRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t("noPending")}
            </p>
          ) : (
            <div className="space-y-2">
              {pendingRequests.map((req: { id: string; code: string; createdAt?: string; meta?: Record<string, unknown> }) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-mono text-sm font-medium">{req.code}</p>
                    {req.createdAt && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(req.createdAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      setApproveCode(req.code);
                      const result = await approveChannelPairing(agentId, channel, req.code);
                      if (result.error) {
                        toast.error(result.error);
                      } else {
                        toast.success(t("approved"));
                        mutatePending();
                        mutatePaired();
                      }
                    }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    {t("approve")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="paired" className="space-y-2 pt-2">
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => mutatePaired()}
              disabled={pairedLoading}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${pairedLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {pairedUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t("noPaired")}
            </p>
          ) : (
            <div className="space-y-2">
              {pairedUsers.map((user: { id: string; username?: string; meta?: Record<string, unknown> }) => {
                const displayName = user.username
                  ? `@${user.username}`
                  : user.id || t("pairedUser");
                const source = (user.meta as any)?.source || "pairing";
                return (
                  <div
                    key={user.id || user.username}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{displayName}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("pairedSource")}: {source}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700"
                      disabled={revokingUserId === user.id}
                      onClick={() => handleRevoke(user.id)}
                    >
                      {revokingUserId === user.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        t("revoke")
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
