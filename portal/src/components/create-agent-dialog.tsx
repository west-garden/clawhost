"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Bot } from "lucide-react";
import { createAgent } from "@/lib/actions";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export function CreateAgentDialog({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const slug = (formData.get("slug") as string) || undefined;
    const soulMd = (formData.get("soulMd") as string) || undefined;

    const result = await createAgent(name, slug, soulMd);
    if (result?.error) {
      toast.error(result.error);
      setLoading(false);
    } else if (result?.id) {
      setOpen(false);
      router.push(`/agents/${result.id}`);
    }
  }

  return (
    <>
      <div onClick={() => setOpen(true)}>{children}</div>
      <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" showCloseButton>
        <SheetHeader>
          <SheetTitle>
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-red-500" />
              {t("dashboard.createAgent")}
            </div>
          </SheetTitle>
          <SheetDescription>
            {t("dashboard.emptyDescription")}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-4 pb-4">
          <div>
            <label className="glass-label">{t("dashboard.agentName")}</label>
            <input
              name="name"
              placeholder={t("dashboard.agentNamePlaceholder")}
              required
              autoFocus
              className="glass-input"
            />
          </div>

          <div>
            <label className="glass-label">{t("dashboard.agentSlug")}</label>
            <input
              name="slug"
              placeholder={t("dashboard.agentSlugPlaceholder")}
              pattern="[a-z0-9\-]*"
              className="glass-input"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t("dashboard.agentSlugHint")}
            </p>
          </div>

          <div>
            <label className="glass-label">
              {t("dashboard.agentPersonality")}
            </label>
            <textarea
              name="soulMd"
              placeholder={t("dashboard.agentPersonalityPlaceholder")}
              rows={4}
              className="glass-input resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="glass-btn-secondary py-2.5 px-5"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="glass-btn py-2.5 px-5"
            >
              <Plus className="w-4 h-4" />
              <span>
                {loading ? t("common.loading") : t("dashboard.createAgent")}
              </span>
            </button>
          </div>
        </form>
      </SheetContent>
      </Sheet>
    </>
  );
}
