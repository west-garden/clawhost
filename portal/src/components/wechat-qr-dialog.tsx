"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { WechatLoginStatusResponse } from "@/types";

interface WechatQrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  onSuccess: () => void;
}

export function WechatQrDialog({
  open,
  onOpenChange,
  agentId,
  onSuccess,
}: WechatQrDialogProps) {
  const t = useTranslations("channels.wechat");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("");

  const startLogin = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}/channels/wechat/login`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.data?.qrcode_url) {
        setQrUrl(data.data.qrcode_url);
        setStatusText(t("waitingScan"));
      }
    } catch {
      toast.error(t("loginFailed"));
    }
  }, [agentId, t]);

  useEffect(() => {
    if (!open) {
      setQrUrl(null);
      setStatusText("");
      return;
    }
    startLogin();
  }, [open, startLogin]);

  useEffect(() => {
    if (!open || !qrUrl) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/agents/${agentId}/channels/wechat/login/status`
        );
        const data = await res.json();
        const status = data.data as WechatLoginStatusResponse | undefined;

        if (!status) return;

        switch (status.status) {
          case "wait":
            setStatusText(t("waitingScan"));
            break;
          case "scaned":
            setStatusText(t("scanned"));
            break;
          case "expired":
            setStatusText(t("expired"));
            clearInterval(interval);
            break;
          case "confirmed":
            setStatusText(t("success"));
            toast.success(t("success"));
            clearInterval(interval);
            onSuccess();
            onOpenChange(false);
            break;
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [open, qrUrl, agentId, t, onSuccess, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("scanQr")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-4 py-4">
          {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrUrl} alt="WeChat QR Code" className="w-64 h-64" />
          ) : (
            <div className="w-64 h-64 bg-gray-100 rounded flex items-center justify-center">
              <span className="text-muted-foreground text-sm">
                {t("scanning")}
              </span>
            </div>
          )}
          <p className="text-sm text-muted-foreground">{statusText}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
