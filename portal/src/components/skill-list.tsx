"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "./confirm-dialog";
import { deleteSkill } from "@/lib/actions";
import { Trash2, FileCode } from "lucide-react";

interface Skill {
  name: string;
}

interface Props {
  agentId: string;
  skills: Skill[];
  loading: boolean;
  onRefresh: () => void;
}

export function SkillList({
  agentId,
  skills,
  loading,
  onRefresh,
}: Props) {
  const t = useTranslations();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await deleteSkill(agentId, deleteTarget);
    setDeleting(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("agent.skills.deleted"));
      setDeleteTarget(null);
      onRefresh();
    }
  }

  if (loading) {
    return <div className="text-white/50 text-sm">{t("common.loading")}</div>;
  }

  if (skills.length === 0) {
    return (
      <div className="text-center py-8 text-white/50 text-sm">
        {t("agent.skills.empty")}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {skills.map((skill) => (
          <div
            key={skill.name}
            className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] hover:bg-white/5"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center">
                <FileCode className="w-4 h-4 text-white/50" />
              </div>
              <span className="text-sm font-medium text-white">
                {skill.name}
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-400 hover:text-red-300"
              onClick={() => setDeleteTarget(skill.name)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title={t("agent.skills.delete")}
        description={t("agent.skills.deleteConfirm", { name: deleteTarget })}
        loading={deleting}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </>
  );
}