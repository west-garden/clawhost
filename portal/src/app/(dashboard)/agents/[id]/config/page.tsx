"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfigModelsPanel } from "@/components/config-models-panel";
import { listModelProviders } from "@/lib/actions";

interface Provider {
  name: string;
  baseUrl?: string;
  apiKey?: string;
  models?: Array<{ id: string; name?: string }>;
}

export default function ConfigPage() {
  const t = useTranslations();
  const params = useParams();
  const agentId = params.id as string;

  const [providers, setProviders] = useState<Record<string, Provider>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProviders();
  }, [agentId]);

  async function loadProviders() {
    setLoading(true);
    const result = await listModelProviders(agentId);
    if (result.error) {
      toast.error(result.error);
    } else {
      setProviders(result.providers || {});
    }
    setLoading(false);
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      <div className="glass-panel">
        <div className="glass-panel-header">
          <span className="font-medium text-white text-sm">
            {t("agent.config.models")}
          </span>
        </div>
        <div className="glass-panel-content">
          <ConfigModelsPanel
            agentId={agentId}
            providers={providers}
            loading={loading}
            onRefresh={loadProviders}
          />
        </div>
      </div>
    </div>
  );
}