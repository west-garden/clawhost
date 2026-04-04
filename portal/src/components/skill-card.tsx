"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "./confirm-dialog";
import { deleteSkill } from "@/lib/actions";
import { Trash2, FileCode, User, Tag, Clock } from "lucide-react";

interface Skill {
  name: string;
  name_display?: string;
  description?: string;
  author?: string;
  version?: string;
  installedAt?: number;
  source?: string;
}

interface Props {
  agentId: string;
  skill: Skill;
  onRefresh: () => void;
}

export function SkillCard({ agentId, skill, onRefresh }: Props) {
  const t = useTranslations();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteSkill(agentId, skill.name);
    setDeleting(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("agent.skills.deleted"));
      setDeleteOpen(false);
      onRefresh();
    }
  }

  const displayName = skill.name_display || skill.name;
  const installedDate = skill.installedAt
    ? new Date(skill.installedAt * 1000).toLocaleDateString()
    : null;

  return (
    <>
      <div className="rounded-lg border bg-card p-4 hover:bg-accent/50 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
              <FileCode className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <h3 className="font-medium text-foreground truncate">
                {displayName}
              </h3>
              <p className="text-xs text-muted-foreground truncate">
                {skill.name}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive shrink-0"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        {skill.description && (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
            {skill.description}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {skill.author && (
            <div className="flex items-center gap-1">
              <User className="w-3 h-3" />
              <span>{skill.author}</span>
            </div>
          )}
          {skill.version && (
            <div className="flex items-center gap-1">
              <Tag className="w-3 h-3" />
              <span>v{skill.version}</span>
            </div>
          )}
          {installedDate && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{installedDate}</span>
            </div>
          )}
          {skill.source && (
            <div className="px-1.5 py-0.5 rounded bg-muted text-xs">
              {skill.source}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={() => setDeleteOpen(false)}
        title={t("agent.skills.delete")}
        description={t("agent.skills.deleteConfirm", { name: displayName })}
        loading={deleting}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </>
  );
}