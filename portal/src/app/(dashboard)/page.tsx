import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { listAgents } from "@/lib/api";
import { CreateAgentDialog } from "@/components/create-agent-dialog";
import { ClawIcon } from "@/components/claw-icon";
import { Plus } from "lucide-react";

export default async function DashboardPage() {
  const agents = await listAgents();

  // If agents exist, redirect to the first one
  if (agents.length > 0) {
    redirect(`/agents/${agents[0].id}`);
  }

  // Empty state
  const t = await getTranslations("dashboard");

  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-red-500/20 to-red-700/20 border border-border flex items-center justify-center mb-6 backdrop-blur-xl mx-auto">
          <ClawIcon className="w-14 h-14 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-3">
          {t("emptyTitle")}
        </h2>
        <p className="text-sm text-muted-foreground mb-8 max-w-sm mx-auto">
          {t("emptyDescription")}
        </p>
        <CreateAgentDialog>
          <button className="glass-btn text-base py-4 px-8">
            <Plus className="w-5 h-5" />
            {t("createAgent")}
          </button>
        </CreateAgentDialog>
      </div>
    </main>
  );
}
