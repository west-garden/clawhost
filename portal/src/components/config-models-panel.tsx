"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  addModelProvider,
  updateModelProvider,
  deleteModelProvider,
  validateProviderApiKey,
  validateCustomProviderApiKey,
} from "@/lib/actions";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

// Provider presets with baseUrl and API format
// Grouped by category for better UX
const PROVIDER_PRESETS: Record<string, { label: string; baseUrl: string; api?: string }> = {
  // --- International Providers ---
  anthropic: {
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    api: "anthropic-messages",
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
  },
  google: {
    label: "Google (Gemini)",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  },
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
  },
  groq: {
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
  },
  mistral: {
    label: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
  },
  xai: {
    label: "xAI (Grok)",
    baseUrl: "https://api.x.ai/v1",
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
  },
  nvidia: {
    label: "NVIDIA (NIM)",
    baseUrl: "https://integrate.api.nvidia.com/v1",
  },

  // --- Chinese Providers (Standard) ---
  zhipu: {
    label: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
  },
  moonshot: {
    label: "Moonshot (Kimi国际)",
    baseUrl: "https://api.moonshot.ai/v1",
  },
  kimi: {
    label: "Kimi (月之暗面)",
    baseUrl: "https://api.moonshot.cn/v1",
  },
  qwen: {
    label: "通义千问 (阿里云)",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },
  minimax: {
    label: "MiniMax",
    baseUrl: "https://api.minimax.chat/v1",
  },
  "minimax-cn": {
    label: "MiniMax (国内)",
    baseUrl: "https://api.minimaxi.com/v1",
  },
  volcengine: {
    label: "火山引擎 (豆包)",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
  },
  xiaomi: {
    label: "小米 (MiMo)",
    baseUrl: "https://api.xiaomimimo.com/v1",
  },

  // --- Coding Plans (Subscription-based) ---
  "qwen-coding": {
    label: "阿里云百炼 Coding Plan",
    baseUrl: "https://coding.dashscope.aliyuncs.com/v1",
  },
  "zhipu-coding": {
    label: "智谱 Coding Plan",
    baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4",
  },
  "moonshot-coding": {
    label: "Kimi Code",
    baseUrl: "https://api.kimi.com/coding",
    api: "anthropic-messages",
  },
  "minimax-coding": {
    label: "MiniMax Coding Plan",
    baseUrl: "https://api.minimaxi.com/v1",
  },
  "volcengine-coding": {
    label: "火山引擎 Coding Plan",
    baseUrl: "https://ark.cn-beijing.volces.com/api/coding/v3",
  },

  // --- Model Platforms ---
  modelscope: {
    label: "ModelScope (魔搭)",
    baseUrl: "https://api-inference.modelscope.cn/v1",
  },
};

interface Provider {
  baseUrl?: string;
  apiKey?: string;
  models?: Array<{ id: string; name?: string }>;
}

interface Props {
  agentId: string;
  providers: Record<string, Provider>;
  loading: boolean;
  onRefresh: () => void;
}

export function ConfigModelsPanel({ agentId, providers, loading, onRefresh }: Props) {
  const t = useTranslations("agent.config");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [presetKey, setPresetKey] = useState<string>("custom");
  const [form, setForm] = useState({
    name: "",
    baseUrl: "",
    apiKey: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; error?: string } | null>(null);

  function openAddDialog() {
    setEditingProvider(null);
    setPresetKey("custom");
    setForm({ name: "", baseUrl: "", apiKey: "" });
    setValidationResult(null);
    setDialogOpen(true);
  }

  function openEditDialog(name: string, provider: Provider) {
    setEditingProvider(name);
    // Find preset key by baseUrl
    let foundPreset = "custom";
    for (const [key, preset] of Object.entries(PROVIDER_PRESETS)) {
      if (preset.baseUrl === provider.baseUrl) {
        foundPreset = key;
        break;
      }
    }
    setPresetKey(foundPreset);
    setForm({
      name,
      baseUrl: provider.baseUrl || "",
      apiKey: "",
    });
    setValidationResult(null);
    setDialogOpen(true);
  }

  function handlePresetChange(key: string) {
    setPresetKey(key);
    setValidationResult(null);
    if (key === "custom") {
      setForm({ ...form, name: "", baseUrl: "" });
    } else {
      const preset = PROVIDER_PRESETS[key];
      setForm({ ...form, name: key, baseUrl: preset.baseUrl });
    }
  }

  async function handleValidate() {
    if (!form.apiKey) {
      toast.error(t("apiKeyRequired"));
      return;
    }

    setValidating(true);
    setValidationResult(null);

    try {
      let result;
      if (presetKey === "custom") {
        // Custom provider validation
        const api = form.baseUrl.includes("anthropic") ? "anthropic-messages" : "openai-completions";
        result = await validateCustomProviderApiKey(form.baseUrl, form.apiKey, api);
      } else {
        // Built-in provider validation
        const preset = PROVIDER_PRESETS[presetKey];
        result = await validateProviderApiKey(presetKey, form.apiKey, form.baseUrl || undefined);
      }

      setValidationResult(result);

      if (result.valid) {
        toast.success(t("apiKeyValid"));
      } else {
        toast.error(result.error || t("apiKeyInvalid"));
      }
    } catch (err) {
      setValidationResult({ valid: false, error: String(err) });
      toast.error(t("validationFailed"));
    } finally {
      setValidating(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const preset = presetKey !== "custom" ? PROVIDER_PRESETS[presetKey] : null;

      if (editingProvider) {
        const result = await updateModelProvider(agentId, editingProvider, {
          baseUrl: form.baseUrl || undefined,
          apiKey: form.apiKey || undefined,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(t("providerUpdated"));
      } else {
        const result = await addModelProvider(agentId, {
          name: form.name,
          baseUrl: form.baseUrl || undefined,
          apiKey: form.apiKey || undefined,
          api: preset?.api || undefined,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(t("providerAdded"));
      }
      setDialogOpen(false);
      onRefresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(name: string) {
    if (!confirm(t("deleteConfirm", { name }))) return;
    const result = await deleteModelProvider(agentId, name);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("providerDeleted"));
      onRefresh();
    }
  }

  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading...</div>;
  }

  return (
    <div className="space-y-3">
      {Object.entries(providers).map(([name, provider]) => (
        <div
          key={name}
          className="flex items-center justify-between p-3 rounded-lg bg-muted hover:bg-accent"
        >
          <div>
            <p className="text-sm font-medium text-foreground">
              {PROVIDER_PRESETS[name]?.label || name}
            </p>
            {provider.baseUrl && (
              <p className="text-xs text-muted-foreground font-mono">{provider.baseUrl}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openEditDialog(name, provider)}
            >
              {t("edit")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => handleDelete(name)}
            >
              {t("delete")}
            </Button>
          </div>
        </div>
      ))}

      <Button size="sm" variant="outline" onClick={openAddDialog}>
        {t("addProvider")}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProvider ? t("editProvider") : t("addProvider")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingProvider && (
              <div className="space-y-2">
                <Label>{t("providerType")}</Label>
                <select
                  value={presetKey}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="custom">{t("customProvider")}</option>
                  {Object.entries(PROVIDER_PRESETS).map(([key, preset]) => (
                    <option key={key} value={key}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!editingProvider && presetKey === "custom" && (
              <div className="space-y-2">
                <Label>{t("providerName")}</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t("providerNamePlaceholder")}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>{t("baseUrl")} {presetKey !== "custom" && t("baseUrlAutoFilled")}</Label>
              <Input
                value={form.baseUrl}
                onChange={(e) => {
                  setForm({ ...form, baseUrl: e.target.value });
                  setValidationResult(null);
                }}
                placeholder="https://api.example.com"
                disabled={presetKey !== "custom"}
              />
              {presetKey !== "custom" && (
                <p className="text-xs text-muted-foreground">
                  {t("baseUrlHint")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t("apiKey")}</Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => {
                    setForm({ ...form, apiKey: e.target.value });
                    setValidationResult(null);
                  }}
                  placeholder={t("apiKeyPlaceholder")}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleValidate}
                  disabled={validating || !form.apiKey}
                >
                  {validating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    t("validate")
                  )}
                </Button>
              </div>

              {/* Validation result */}
              {validationResult && (
                <div className={`flex items-center gap-2 text-sm ${validationResult.valid ? "text-green-600" : "text-red-600"}`}>
                  {validationResult.valid ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{t("apiKeyValid")}</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      <span>{validationResult.error || t("apiKeyInvalid")}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}