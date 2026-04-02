"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "./confirm-dialog";
import { approveDevice, revokeDevice } from "@/lib/actions";
import { Check, X, Monitor, Smartphone, Terminal } from "lucide-react";

interface Device {
  request_id?: string;
  device_id: string;
  platform?: string;
  client_mode?: string;
  ip?: string;
  age?: string;
  status: "pending" | "paired" | "revoked";
  connected?: boolean;
}

interface Props {
  agentId: string;
  devices: Device[];
  loading: boolean;
  type: "pending" | "paired";
  onRefresh: () => void;
}

const platformIcons: Record<string, React.ReactNode> = {
  web: <Monitor className="w-4 h-4" />,
  mobile: <Smartphone className="w-4 h-4" />,
  cli: <Terminal className="w-4 h-4" />,
};

export function DeviceList({
  agentId,
  devices,
  loading,
  type,
  onRefresh,
}: Props) {
  const t = useTranslations();
  const [actionTarget, setActionTarget] = useState<Device | null>(null);
  const [acting, setActing] = useState(false);

  async function handleApprove() {
    if (!actionTarget?.request_id) return;
    setActing(true);
    const result = await approveDevice(agentId, actionTarget.request_id);
    setActing(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("agent.devices.approved"));
      setActionTarget(null);
      onRefresh();
    }
  }

  async function handleRevoke() {
    if (!actionTarget?.device_id) return;
    setActing(true);
    const result = await revokeDevice(agentId, actionTarget.device_id);
    setActing(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("agent.devices.revoked"));
      setActionTarget(null);
      onRefresh();
    }
  }

  if (loading) {
    return <div className="text-white/50 text-sm">{t("common.loading")}</div>;
  }

  if (devices.length === 0) {
    return (
      <div className="text-center py-4 text-white/50 text-sm">
        {type === "pending" ? t("agent.devices.noPending") : t("agent.devices.noPaired")}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {devices.map((device) => (
          <div
            key={device.request_id || device.device_id}
            className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] hover:bg-white/5"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-white/50">
                {platformIcons[device.client_mode || ""] || <Monitor className="w-4 h-4" />}
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  {device.platform || device.client_mode || "Unknown"}
                </p>
                <p className="text-xs text-white/40">
                  {device.ip && `${device.ip} · `}
                  {device.age || "Just now"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {device.connected && (
                <Badge variant="outline" className="text-green-400 border-green-400/30">
                  Connected
                </Badge>
              )}
              {type === "pending" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-green-400 hover:text-green-300"
                  onClick={() => setActionTarget(device)}
                >
                  <Check className="w-4 h-4" />
                </Button>
              )}
              {type === "paired" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-400 hover:text-red-300"
                  onClick={() => setActionTarget(device)}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {type === "pending" && (
        <ConfirmDialog
          open={!!actionTarget}
          onOpenChange={() => setActionTarget(null)}
          title={t("agent.devices.approve")}
          description={t("agent.devices.approveConfirm")}
          loading={acting}
          onConfirm={handleApprove}
          confirmText={t("agent.devices.approve")}
        />
      )}

      {type === "paired" && (
        <ConfirmDialog
          open={!!actionTarget}
          onOpenChange={() => setActionTarget(null)}
          title={t("agent.devices.revoke")}
          description={t("agent.devices.revokeConfirm")}
          loading={acting}
          onConfirm={handleRevoke}
          variant="destructive"
          confirmText={t("agent.devices.revoke")}
        />
      )}
    </>
  );
}