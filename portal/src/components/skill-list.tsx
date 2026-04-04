"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { SkillCard } from "./skill-card";
import { deleteSkill } from "@/lib/actions";

interface Skill {
  name: string;
  name_display?: string;
  description?: string;
  author?: string;
  version?: string;
  installedAt?: number;
  source?: string;
}

interface Props {
  agentId: string;
  skills: Skill[];
  loading: boolean;
  onRefresh: () => void;
}

export function SkillList({
  agentId,
  skills,
  loading,
  onRefresh,
}: Props) {
  const t = useTranslations();

  if (loading) {
    return <div className="text-muted-foreground text-sm">{t("common.loading")}</div>;
  }

  if (skills.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        {t("agent.skills.empty")}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {skills.map((skill) => (
        <SkillCard
          key={skill.name}
          agentId={agentId}
          skill={skill}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}