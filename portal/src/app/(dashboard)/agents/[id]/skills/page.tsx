"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SkillList } from "@/components/skill-list";
import { SkillInstallDialog } from "@/components/skill-install-dialog";
import { SkillCreateDialog } from "@/components/skill-create-dialog";
import { listSkills } from "@/lib/actions";
import { Download, Plus } from "lucide-react";

interface Skill {
  name: string;
}

export default function SkillsPage() {
  const t = useTranslations();
  const params = useParams();
  const agentId = params.id as string;

  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [installOpen, setInstallOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

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
          <span className="font-medium text-foreground text-sm">
            {t("agent.skills.title")}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setInstallOpen(true)}
            >
              <Download className="w-4 h-4 mr-1" />
              {t("agent.skills.install")}
            </Button>
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              {t("agent.skills.create")}
            </Button>
          </div>
        </div>
        <div className="glass-panel-content">
          <SkillList
            agentId={agentId}
            skills={skills}
            loading={loading}
            onRefresh={loadSkills}
          />
        </div>
      </div>

      <SkillInstallDialog
        open={installOpen}
        onOpenChange={setInstallOpen}
        agentId={agentId}
        onSuccess={loadSkills}
      />

      <SkillCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        agentId={agentId}
        onSuccess={loadSkills}
      />
    </div>
  );
}