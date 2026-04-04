"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SkillList } from "@/components/skill-list";
import { MarketplaceTab } from "@/components/marketplace-tab";
import { SkillInstallDialog } from "@/components/skill-install-dialog";
import { SkillCreateDialog } from "@/components/skill-create-dialog";
import { listSkills } from "@/lib/actions";
import { useAgent } from "@/contexts/agent-context";
import { Download, Plus, RefreshCw } from "lucide-react";

interface Skill {
  name: string;
  name_display?: string;
  description?: string;
  author?: string;
  version?: string;
  installedAt?: number;
  source?: string;
}

export default function SkillsPage() {
  const t = useTranslations();
  const params = useParams();
  const agentId = params.id as string;

  const { isRunning } = useAgent();

  const [activeTab, setActiveTab] = useState<"marketplace" | "installed">("marketplace");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [installOpen, setInstallOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!isRunning) {
      setLoading(false);
      setSkills([]);
      return;
    }
    loadSkills();
  }, [agentId, isRunning]);

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

  // Get list of installed skill names for marketplace comparison
  const installedSkillNames = skills.map((s) => s.name);

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      <div className="glass-panel">
        <div className="glass-panel-header">
          <span className="font-medium text-foreground text-sm">
            {t("agent.skills.title")}
          </span>
          <div className="flex gap-2">
            {/* Tab buttons */}
            <div className="flex border rounded-md p-1">
              <Button
                size="sm"
                variant={activeTab === "marketplace" ? "default" : "ghost"}
                onClick={() => setActiveTab("marketplace")}
                className="rounded-none first:rounded-l-md"
              >
                {t("agent.skills.marketplace")}
              </Button>
              <Button
                size="sm"
                variant={activeTab === "installed" ? "default" : "ghost"}
                onClick={() => setActiveTab("installed")}
                className="rounded-none last:rounded-r-md"
              >
                {t("agent.skills.installedTab")} ({skills.length})
              </Button>
            </div>
          </div>
        </div>
        <div className="glass-panel-content">
          {activeTab === "marketplace" ? (
            <MarketplaceTab
              agentId={agentId}
              installedSkills={installedSkillNames}
              onRefreshInstalled={loadSkills}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={loadSkills}
                  disabled={!isRunning || loading}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setInstallOpen(true)}
                  disabled={!isRunning}
                >
                  <Download className="w-4 h-4 mr-1" />
                  {t("agent.skills.install")}
                </Button>
                <Button
                  size="sm"
                  onClick={() => setCreateOpen(true)}
                  disabled={!isRunning}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t("agent.skills.create")}
                </Button>
              </div>
              <SkillList
                agentId={agentId}
                skills={skills}
                loading={loading}
                onRefresh={loadSkills}
              />
            </div>
          )}
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