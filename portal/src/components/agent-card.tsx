import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { AgentStatusBadge } from "./agent-status-badge";
import type { Agent } from "@/types";

export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Link href={`/agents/${agent.id}`}>
      <Card className="cursor-pointer transition-shadow hover:shadow-md">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <h3 className="font-medium truncate">{agent.name}</h3>
            <AgentStatusBadge status={agent.status} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {agent.slug}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
