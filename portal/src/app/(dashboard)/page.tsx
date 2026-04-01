import { getTranslations } from "next-intl/server";
import { listAgents } from "@/lib/api";
import { AgentCard } from "@/components/agent-card";
import { CreateAgentDialog } from "@/components/create-agent-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const agents = await listAgents();

  // Empty state
  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h2 className="text-xl font-semibold">{t("emptyTitle")}</h2>
        <p className="mt-2 text-muted-foreground">{t("emptyDescription")}</p>
        <CreateAgentDialog>
          <Button className="mt-6" size="lg">
            {t("createAgent")}
          </Button>
        </CreateAgentDialog>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">{t("title")}</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}

        {/* Create new agent card */}
        <CreateAgentDialog>
          <Card className="cursor-pointer border-dashed transition-shadow hover:shadow-md">
            <CardContent className="flex items-center justify-center p-8">
              <div className="text-center text-muted-foreground">
                <div className="text-3xl mb-1">+</div>
                <div className="text-sm">{t("createAgent")}</div>
              </div>
            </CardContent>
          </Card>
        </CreateAgentDialog>
      </div>
    </div>
  );
}
