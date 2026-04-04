"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarketplaceSkillCard } from "./marketplace-skill-card";
import { listMarketplaceSkills } from "@/lib/actions";
import { RefreshCw, Search } from "lucide-react";

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
  installedSkills: string[];
  onRefreshInstalled: () => void;
}

export function MarketplaceTab({
  agentId,
  installedSkills,
  onRefreshInstalled,
}: Props) {
  const t = useTranslations("agent.skills");
  const [skills, setSkills] = useState<MarketplaceSkill[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMarketplace();
  }, [selectedCategory, search]);

  async function loadMarketplace() {
    setLoading(true);
    const result = await listMarketplaceSkills(
      selectedCategory || undefined,
      search || undefined
    );
    if (result.error) {
      toast.error(result.error);
    } else {
      setSkills(result.skills || []);
      setCategories(result.categories || []);
    }
    setLoading(false);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
  }

  function handleCategoryChange(value: string) {
    setSelectedCategory(value);
  }

  return (
    <div className="space-y-4">
      {/* Search and filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="">{t("allCategories")}</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="ghost"
          onClick={loadMarketplace}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Skills grid */}
      {loading ? (
        <div className="text-muted-foreground text-sm">{t("loading")}</div>
      ) : skills.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No skills found
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => (
            <MarketplaceSkillCard
              key={skill.name}
              agentId={agentId}
              skill={skill}
              isInstalled={installedSkills.includes(skill.name) || installedSkills.includes(skill.path)}
              onRefresh={onRefreshInstalled}
            />
          ))}
        </div>
      )}
    </div>
  );
}