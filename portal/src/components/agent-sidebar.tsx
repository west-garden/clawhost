"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { CreateAgentDialog } from "./create-agent-dialog";
import { LocaleSwitcher } from "./locale-switcher";
import { ClawIcon } from "./claw-icon";
import { Plus, Settings, LogOut } from "lucide-react";
import type { Agent, User } from "@/types";

const AGENT_COLORS = [
  "from-red-500 to-red-700",
  "from-blue-500 to-blue-700",
  "from-purple-500 to-purple-700",
  "from-amber-500 to-amber-700",
  "from-emerald-500 to-emerald-700",
  "from-pink-500 to-pink-700",
  "from-cyan-500 to-cyan-700",
  "from-orange-500 to-orange-700",
];

function getAgentColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length];
}

function getStatusDotClass(status: string): string {
  const map: Record<string, string> = {
    running: "status-dot-running",
    stopped: "status-dot-stopped",
    starting: "status-dot-starting",
    created: "status-dot-created",
    error: "status-dot-error",
  };
  return map[status] || "status-dot-created";
}

interface AgentSidebarContentProps {
  agents: Agent[];
  user: User;
  locale: string;
  onNavigate?: () => void;
}

export function AgentSidebarContent({
  agents,
  user,
  locale,
  onNavigate,
}: AgentSidebarContentProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();

  const activeAgentId = pathname.match(/\/agents\/([^/]+)/)?.[1];

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
          <ClawIcon className="w-5 h-5" />
        </div>
        <span className="font-semibold text-base text-white">ClawHost</span>
      </div>

      {/* New Agent button */}
      <div className="px-3 pt-3 pb-1">
        <CreateAgentDialog>
          <button className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-gradient-to-r from-red-500/20 to-red-700/20 border border-red-500/30 text-red-400 text-xs font-medium hover:from-red-500/30 hover:to-red-700/30 transition-all">
            <Plus className="w-3.5 h-3.5" />
            {t("sidebar.newAgent")}
          </button>
        </CreateAgentDialog>
      </div>

      {/* Agent list label */}
      <div className="px-4 pt-4 pb-2 text-[10px] uppercase tracking-widest text-white/30">
        Agents
      </div>

      {/* Agent list */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {agents.map((agent) => {
          const isActive = agent.id === activeAgentId;
          const initial = (agent.name || "?")[0].toUpperCase();
          const color = getAgentColor(agent.name);

          return (
            <a
              key={agent.id}
              href={`/agents/${agent.id}`}
              onClick={(e) => {
                e.preventDefault();
                onNavigate?.();
                router.push(`/agents/${agent.id}`);
              }}
              className={cn(
                "agent-sidebar-item",
                isActive && "agent-sidebar-item-active"
              )}
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-md bg-gradient-to-br flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0",
                  color
                )}
              >
                {initial}
              </div>
              <span
                className={cn(
                  "text-[13px] font-medium flex-1 truncate",
                  isActive ? "text-white" : "text-white/50"
                )}
              >
                {agent.name}
              </span>
              <div
                className={cn("status-dot", getStatusDotClass(agent.status))}
              />
            </a>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-3 space-y-3">
        <div className="flex items-center gap-2.5 px-1">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-red-500/20 to-red-700/20 border border-white/10 flex items-center justify-center">
            <span className="text-[10px] font-medium text-white">
              {(user.name || user.email || "?").slice(0, 2).toUpperCase()}
            </span>
          </div>
          <span className="text-xs text-white/60 truncate flex-1">
            {user.name || user.email}
          </span>
          <LocaleSwitcher locale={locale} />
        </div>
        <div className="flex gap-2">
          <a
            href="/settings"
            onClick={(e) => {
              e.preventDefault();
              onNavigate?.();
              router.push("/settings");
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs hover:bg-white/10 hover:text-white/70 transition-all"
          >
            <Settings className="w-3.5 h-3.5" />
            {t("sidebar.settings")}
          </a>
          <button
            onClick={handleLogout}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t("sidebar.logout")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AgentSidebar({
  agents,
  user,
  locale,
}: {
  agents: Agent[];
  user: User;
  locale: string;
}) {
  return (
    <aside className="hidden md:flex h-full agent-sidebar">
      <AgentSidebarContent agents={agents} user={user} locale={locale} />
    </aside>
  );
}
