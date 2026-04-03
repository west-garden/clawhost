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
import { createSkill } from "@/lib/actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  onSuccess: () => void;
}

const defaultContent = `---
name: my-skill
description: A new skill
---

# My Skill

Describe your skill here...
`;

export function SkillCreateDialog({ open, onOpenChange, agentId, onSuccess }: Props) {
  const t = useTranslations();
  const [name, setName] = useState("");
  const [content, setContent] = useState(defaultContent);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim()) {
      toast.error(t("common.error"));
      return;
    }

    setLoading(true);
    const result = await createSkill(agentId, name.trim(), content);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("agent.skills.created"));
      setName("");
      setContent(defaultContent);
      onOpenChange(false);
      onSuccess();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("agent.skills.createTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="skill-name">{t("agent.skills.createTitle")}</Label>
            <Input
              id="skill-name"
              placeholder={t("agent.skills.namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("agent.skills.nameHint")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="skill-content">Markdown</Label>
            <textarea
              id="skill-content"
              className="flex min-h-[300px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
              placeholder={t("agent.skills.contentPlaceholder")}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? t("agent.skills.creating") : t("agent.skills.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}