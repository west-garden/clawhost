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
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="appearance-none bg-muted border border-border rounded-lg px-3 py-1.5 pr-8 text-sm text-foreground cursor-pointer hover:bg-accent focus:outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {modelOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
    </div>
  );
}