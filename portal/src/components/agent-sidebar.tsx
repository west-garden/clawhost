"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { CreateAgentDialog } from "./create-agent-dialog";
import { LocaleSwitcher } from "./locale-switcher";
import { ClawIcon } from "./claw-icon";
import { Plus, Settings, LogOut, CreditCard } from "lucide-react";
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

  const activeAgentId = pathname.match(/\/agents\/([^/]+)/)?.[1];

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
          <ClawIcon className="w-5 h-5 text-white" />
        </div>
        <span className="font-semibold text-base text-foreground">ClawHost</span>
      </div>

      {/* New Agent button */}
      <div className="px-3 pt-4 pb-2">
        <CreateAgentDialog>
          <button className="w-full flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-lg bg-gradient-to-r from-red-500/20 to-red-700/20 border border-red-500/30 text-red-400 text-base font-medium hover:from-red-500/30 hover:to-red-700/30 hover:border-red-500/40 active:scale-[0.98] transition-all duration-150">
            <Plus className="w-4 h-4" />
            {t("sidebar.newAgent")}
          </button>
        </CreateAgentDialog>
      </div>

      {/* Agent list label */}
      <div className="px-4 pt-2 pb-2 text-xs uppercase tracking-widest text-muted-foreground font-medium">
        Agents
      </div>

      {/* Agent list + nav items (scrollable together) */}
      <nav className="flex-1 overflow-y-auto min-h-0 px-2 py-1 space-y-0.5">
        {agents.map((agent) => {
          const isActive = agent.id === activeAgentId;
          const initial = (agent.name || "?")[0].toUpperCase();
          const color = getAgentColor(agent.name);

          return (
            <Link
              key={agent.id}
              href={`/agents/${agent.id}`}
              onClick={onNavigate}
              className={cn(
                "agent-sidebar-item",
                isActive && "agent-sidebar-item-active"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center text-sm font-semibold text-white flex-shrink-0",
                  color
                )}
              >
                {initial}
              </div>
              <span
                className={cn(
                  "text-base font-medium flex-1 truncate",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {agent.name}
              </span>
              <div
                className={cn("status-dot", getStatusDotClass(agent.status))}
              />
            </Link>
          );
        })}

        {/* Subscription + Settings nav items */}
        <div className="!mt-2 pt-2 border-t border-border space-y-0.5">
        <Link
          href="/subscription"
          onClick={onNavigate}
          className={cn(
            "agent-sidebar-item",
            pathname === "/subscription" && "agent-sidebar-item-active"
          )}
        >
          <CreditCard
            className={cn(
              "w-5 h-5 flex-shrink-0",
              pathname === "/subscription" ? "text-foreground" : "text-muted-foreground"
            )}
          />
          <span
            className={cn(
              "text-base font-medium",
              pathname === "/subscription" ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {t("sidebar.subscription")}
          </span>
        </Link>
        <Link
          href="/settings"
          onClick={onNavigate}
          className={cn(
            "agent-sidebar-item",
            pathname === "/settings" && "agent-sidebar-item-active"
          )}
        >
          <Settings
            className={cn(
              "w-5 h-5 flex-shrink-0",
              pathname === "/settings" ? "text-foreground" : "text-muted-foreground"
            )}
          />
          <span
            className={cn(
              "text-base font-medium",
              pathname === "/settings" ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {t("sidebar.settings")}
          </span>
        </Link>
        </div>
      </nav>

      {/* Footer: user info + logout */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500/20 to-red-700/20 border border-border flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-medium text-foreground">
              {(user.name || user.email || "?").slice(0, 2).toUpperCase()}
            </span>
          </div>
          <span className="text-sm text-muted-foreground truncate flex-1">
            {user.name || user.email}
          </span>
          <LocaleSwitcher locale={locale} />
          <button
            onClick={handleLogout}
            className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 active:scale-95 transition-all duration-150"
            title={t("sidebar.logout")}
          >
            <LogOut className="w-4 h-4" />
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
