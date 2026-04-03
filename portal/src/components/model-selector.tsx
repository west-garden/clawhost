"use client";

import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import type { ProviderWithModels } from "@/types";

interface ModelSelectorProps {
  providers: Record<string, ProviderWithModels>;
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
}

export function ModelSelector({
  providers,
  value,
  onChange,
  disabled,
}: ModelSelectorProps) {
  const t = useTranslations("chat");

  // Build model list from providers
  const modelOptions: { value: string; label: string; provider: string }[] = [];

  Object.entries(providers).forEach(([providerName, provider]) => {
    if (provider.models && provider.models.length > 0) {
      provider.models.forEach((model) => {
        modelOptions.push({
          value: `${providerName}/${model.id}`,
          label: model.name || model.id,
          provider: providerName,
        });
      });
    }
  });

  if (modelOptions.length === 0) {
    return null;
  }

  return (
    <div className="relative inline-flex">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="glass-btn-secondary !py-1.5 !px-3 !text-xs appearance-none pr-7 cursor-pointer"
      >
        {modelOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
    </div>
  );
}