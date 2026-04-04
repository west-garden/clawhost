"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { installMarketplaceSkill } from "@/lib/actions";
import { Loader2, Download, CheckCircle2 } from "lucide-react";

interface MarketplaceSkill {
  name: string;
  display_name: string;
  description: string;
  author: string;
  version: string;
  category: string;
  tags: string[];
  path: string;
}

interface Props {
  agentId: string;
  skill: MarketplaceSkill;
  isInstalled: boolean;
  onRefresh: () => void;
}

export function MarketplaceSkillCard({
  agentId,
  skill,
  isInstalled,
  onRefresh,
}: Props) {
  const t = useTranslations("agent.skills");
  const [loading, setLoading] = useState(false);

  async function handleInstall() {
    setLoading(true);
    const result = await installMarketplaceSkill(agentId, skill.name);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("installed"));
      onRefresh();
    }
  }

  return (
    <div className="p-4 rounded-lg bg-muted hover:bg-accent transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-medium text-foreground">
            {skill.display_name || skill.name}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("byAuthor", { author: skill.author })} · {t("version", { version: skill.version })}
          </p>
        </div>
        {isInstalled ? (
          <div className="flex items-center gap-1 text-sm text-green-600">
            <CheckCircle2 className="w-4 h-4" />
            <span>{t("alreadyInstalled")}</span>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={handleInstall}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-1" />
            )}
            {t("installFromMarketplace")}
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-2">
        {skill.description}
      </p>
      <div className="flex gap-2 text-xs">
        <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
          {skill.category}
        </span>
        {skill.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="text-muted-foreground">
            #{tag}
          </span>
        ))}
      </div>
    </div>
  );
}