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
  DialogTrigger,
} from "@/components/ui/dialog";
import { createAgent } from "@/lib/actions";

export function CreateAgentDialog({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;

    try {
      const result = await createAgent(name);
      if (result?.error) {
        toast.error(result.error);
        setLoading(false);
      }
      // On success, createAgent calls redirect() so we won't reach here
    } catch {
      // redirect() throws a NEXT_REDIRECT error which is expected
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<span />}>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("dashboard.createAgent")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agent-name">{t("dashboard.agentName")}</Label>
            <Input
              id="agent-name"
              name="name"
              placeholder={t("dashboard.agentNamePlaceholder")}
              required
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t("dashboard.creating") : t("dashboard.createAgent")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
