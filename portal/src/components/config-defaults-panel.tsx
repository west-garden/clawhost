"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { getAgentDefaults, setAgentDefaults, listModelProviders } from "@/lib/actions";

interface Props {
  agentId: string;
}

export function ConfigDefaultsPanel({ agentId }: Props) {
  const t = useTranslations("agent.config");
  const [primaryModel, setPrimaryModel] = useState("");
  const [fallbackModel, setFallbackModel] = useState("");
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch current defaults + available models on mount
  useEffect(() => {
    (async () => {
      try {
        const [defaultsResult, providersResult] = await Promise.all([
          getAgentDefaults(agentId),
          listModelProviders(agentId),
        ]);

        // Build model options first (inline, not from state)
        const models: string[] = [];
        if (!providersResult.error && providersResult.providers) {
          for (const [providerName, provider] of Object.entries(
            providersResult.providers as Record<string, { models?: Array<{ id: string }> }>
          )) {
            if (provider.models) {
              for (const m of provider.models) {
                models.push(`${providerName}/${m.id}`);
              }
            }
          }
        }
        setModelOptions(models);

        if (!defaultsResult.error && defaultsResult.defaults) {
          const d = defaultsResult.defaults;
          const currentPrimary = d.model?.primary ?? "";
          const currentFallback = d.fallback_model ?? "";

          // If current primary doesn't exist in any configured provider,
          // auto-fix to the first available model
          if (currentPrimary && !models.includes(currentPrimary)) {
            const firstModel = models.length > 0 ? models[0] : "";
            if (firstModel) {
              setPrimaryModel(firstModel);
              await setAgentDefaults(agentId, { primary_model: firstModel });
              toast.info(`主模型 "${currentPrimary}" 不存在，已自动设为 "${firstModel}"`);
            } else {
              toast.warning(`主模型 "${currentPrimary}" 在任何提供商中都未找到`);
            }
          } else {
            setPrimaryModel(currentPrimary);
          }
          setFallbackModel(currentFallback);
        }
      } catch {
        // Silently ignore — user will see empty form
      } finally {
        setLoading(false);
      }
    })();
  }, [agentId]);

  async function handleSave() {
    setSaving(true);
    try {
      const result = await setAgentDefaults(agentId, {
        primary_model: primaryModel,
        fallback_model: fallbackModel,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("默认设置已更新");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        加载中...
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label>{t("primaryModel") || "Primary Model"}</Label>
        <select
          value={primaryModel}
          onChange={(e) => setPrimaryModel(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">— 选择模型 —</option>
          {modelOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        {modelOptions.length === 0 && (
          <p className="text-xs text-muted-foreground">
            在"模型"标签页添加模型提供商后，此处将显示可用选项。
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>{t("fallbackModel") || "Fallback Model"}</Label>
        <select
          value={fallbackModel}
          onChange={(e) => setFallbackModel(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">— 无 —</option>
          {modelOptions.map((m) => (
            <option key={`fb-${m}`} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <Button onClick={handleSave} disabled={saving || !primaryModel}>
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            {t("saving")}
          </>
        ) : (
          t("save")
        )}
      </Button>
    </div>
  );
}
