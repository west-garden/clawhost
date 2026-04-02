"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { SkillList } from "@/components/skill-list";
import { listSkills } from "@/lib/actions";
import type { AgentStatus } from "@/types";

interface Skill {
  name: string;
}

export default function SkillsPage() {
  const t = useTranslations();
  const params = useParams();
  const agentId = params.id as string;

  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("stopped");

  useEffect(() => {
    loadSkills();
  }, [agentId]);

  async function loadSkills() {
    setLoading(true);
    const result = await listSkills(agentId);
    if (result.error) {
      toast.error(result.error);
    } else {
      setSkills(result.skills || []);
    }
    setLoading(false);
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      <div className="glass-panel">
        <div className="glass-panel-header">
          <span className="font-medium text-white text-sm">
            {t("agent.skills.title")}
          </span>
        </div>
        <div className="glass-panel-content">
          <SkillList
            agentId={agentId}
            skills={skills}
            loading={loading}
            agentStatus={agentStatus}
            onRefresh={loadSkills}
          />
        </div>
      </div>
    </div>
  );
}