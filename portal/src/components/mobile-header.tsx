"use client";

import { useState } from "react";
import { AgentSidebarContent } from "./agent-sidebar";
import type { Agent, User } from "@/types";
import { ClawIcon } from "./claw-icon";
import { Menu } from "lucide-react";

export function MobileHeader({
  agents,
  user,
  locale,
}: {
  agents: Agent[];
  user: User;
  locale: string;
}) {
  const [open, setOpen] = useState(false);

  const initials = (user.name || user.email || "?")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      {/* Mobile header bar */}
      <header className="flex md:hidden items-center justify-between glass-header px-4 h-14 sticky top-0 z-30">
        <button
          onClick={() => setOpen(true)}
          className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:bg-white/10 transition-all"
          aria-label="Menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
            <ClawIcon className="w-4 h-4" />
          </div>
          <span className="font-semibold text-sm text-white">ClawHost</span>
        </div>

        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500/20 to-red-700/20 border border-white/10 flex items-center justify-center">
          <span className="text-[10px] font-medium text-white">{initials}</span>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="fixed top-0 left-0 bottom-0 w-[260px] agent-sidebar z-50 md:hidden">
            <AgentSidebarContent
              agents={agents}
              user={user}
              locale={locale}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </>
      )}
    </>
  );
}
