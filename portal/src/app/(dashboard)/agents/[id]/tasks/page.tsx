"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { TaskList } from "@/components/task-list";
import { listCronJobs } from "@/lib/actions";

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  timezone?: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

export default function TasksPage() {
  const t = useTranslations();
  const params = useParams();
  const agentId = params.id as string;

  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJobs();
  }, [agentId]);

  async function loadJobs() {
    setLoading(true);
    const result = await listCronJobs(agentId);
    if (result.error) {
      toast.error(result.error);
    } else {
      setJobs(result.jobs || []);
    }
    setLoading(false);
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      <div className="glass-panel">
        <div className="glass-panel-header">
          <span className="font-medium text-foreground text-sm">
            {t("agent.tasks.title")}
          </span>
        </div>
        <div className="glass-panel-content">
          <TaskList
            agentId={agentId}
            jobs={jobs}
            loading={loading}
            onRefresh={loadJobs}
          />
        </div>
      </div>
    </div>
  );
}