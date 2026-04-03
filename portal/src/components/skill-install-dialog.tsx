"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { installSkill } from "@/lib/actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  onSuccess: () => void;
}

export function SkillInstallDialog({ open, onOpenChange, agentId, onSuccess }: Props) {
  const t = useTranslations();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleInstall() {
    if (!url.trim()) {
      toast.error(t("common.error"));
      return;
    }

    setLoading(true);
    const result = await installSkill(agentId, url.trim());
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("agent.skills.installed"));
      setUrl("");
      onOpenChange(false);
      onSuccess();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("agent.skills.installTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="github-url">GitHub URL / Spec</Label>
            <Input
              id="github-url"
              placeholder={t("agent.skills.installPlaceholder")}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInstall()}
            />
            <p className="text-xs text-muted-foreground">
              {t("agent.skills.installHint")}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleInstall} disabled={loading}>
            {loading ? t("agent.skills.installing") : t("agent.skills.install")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}