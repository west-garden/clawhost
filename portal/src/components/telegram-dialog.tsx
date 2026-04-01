"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addChannel } from "@/lib/actions";

interface TelegramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  onSuccess: () => void;
}

export function TelegramDialog({
  open,
  onOpenChange,
  agentId,
  onSuccess,
}: TelegramDialogProps) {
  const t = useTranslations();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const botToken = formData.get("botToken") as string;

    const result = await addChannel(agentId, "telegram", { botToken });

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("channels.telegram.added"));
      onSuccess();
      onOpenChange(false);
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("channels.telegram.name")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="botToken">{t("channels.telegram.botToken")}</Label>
            <Input
              id="botToken"
              name="botToken"
              placeholder={t("channels.telegram.botTokenPlaceholder")}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t("common.loading") : t("common.confirm")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
