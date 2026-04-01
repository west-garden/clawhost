"use client";

import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { SidebarContent } from "./sidebar";
import type { User } from "@/types";

export function MobileHeader({
  user,
  locale,
}: {
  user: User;
  locale: string;
}) {
  const [open, setOpen] = useState(false);

  const initials = (user.name || user.email || "?")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      {/* Mobile header bar */}
      <header className="flex md:hidden items-center justify-between border-b bg-white px-4 h-14">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          aria-label="Menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="6" y2="6" />
            <line x1="4" x2="20" y1="18" y2="18" />
          </svg>
        </Button>
        <span className="font-semibold">ClawHost</span>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      </header>

      {/* Desktop header bar (just avatar, right side) */}
      <header className="hidden md:flex items-center justify-end border-b bg-white px-6 h-14">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{user.name || user.email}</span>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Mobile sidebar sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-60 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent
            user={user}
            locale={locale}
            onNavigate={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
