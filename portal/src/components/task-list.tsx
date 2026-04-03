"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "./confirm-dialog";
import { runCronJob, toggleCronJob, deleteCronJob } from "@/lib/actions";
import { Play, Trash2 } from "lucide-react";

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  timezone?: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

interface Props {
  agentId: string;
  jobs: CronJob[];
  loading: boolean;
  onRefresh: () => void;
}

export function TaskList({ agentId, jobs, loading, onRefresh }: Props) {
  const t = useTranslations();
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CronJob | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleRun(jobId: string) {
    setRunningJob(jobId);
    const result = await runCronJob(agentId, jobId);
    setRunningJob(null);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("agent.tasks.ran"));
      onRefresh();
    }
  }

  async function handleToggle(jobId: string, enabled: boolean) {
    const result = await toggleCronJob(agentId, jobId, enabled);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(enabled ? t("agent.tasks.enabled") : t("agent.tasks.disabled"));
      onRefresh();
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await deleteCronJob(agentId, deleteTarget.id);
    setDeleting(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("agent.tasks.deleted"));
      setDeleteTarget(null);
      onRefresh();
    }
  }

  if (loading) {
    return <div className="text-muted-foreground text-sm">{t("common.loading")}</div>;
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        {t("agent.tasks.empty")}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="flex items-center justify-between p-4 rounded-lg bg-muted hover:bg-accent"
          >
            <div className="flex items-center gap-4">
              <div className={`w-2 h-2 rounded-full ${job.enabled ? "bg-green-500" : "bg-gray-400"}`} />
              <div>
                <div className="font-medium text-foreground">{job.name}</div>
                <div className="text-sm text-muted-foreground">
                  {job.schedule}
                  {job.timezone && ` (${job.timezone})`}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={job.enabled}
                  onCheckedChange={(checked) => handleToggle(job.id, checked)}
                />
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRun(job.id)}
                disabled={runningJob === job.id}
              >
                <Play className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteTarget(job)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title={t("agent.tasks.delete")}
        description={deleteTarget ? t("agent.tasks.deleteConfirm", { name: deleteTarget.name }) : ""}
        loading={deleting}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </>
  );
}