"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Loader2 } from "lucide-react";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startLogin = useCallback(async () => {
    setLoading(true);
    setError(null);
    setQrUrl(null);
    setStatusText("");
    try {
      const res = await fetch(`/api/agents/${agentId}/channels/wechat/login`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.data?.qrcode_url) {
        setQrUrl(data.data.qrcode_url);
        setStatusText(t("waitingScan"));
      } else if (data.message) {
        setError(data.message);
      }
    } catch {
      setError(t("loginFailed"));
    } finally {
      setLoading(false);
    }
  }, [agentId, t]);

  useEffect(() => {
    if (!open) {
      setQrUrl(null);
      setStatusText("");
      setError(null);
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
          {loading ? (
            <div className="w-64 h-64 bg-gray-50 rounded-lg flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-2" />
              <span className="text-muted-foreground text-sm">
                {t("loading")}
              </span>
            </div>
          ) : error ? (
            <div className="w-64 h-64 bg-gray-50 rounded-lg flex flex-col items-center justify-center">
              <span className="text-red-500 text-sm mb-3">{error}</span>
              <button
                onClick={startLogin}
                className="text-sm text-primary hover:underline"
              >
                {t("retry")}
              </button>
            </div>
          ) : qrUrl ? (
            <div className="w-64 h-64 bg-white rounded-lg flex items-center justify-center p-4">
              <QRCodeSVG value={qrUrl} size={224} level="H" />
            </div>
          ) : (
            <div className="w-64 h-64 bg-gray-50 rounded-lg flex items-center justify-center">
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
