"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "./locale-switcher";
import type { User } from "@/types";

interface SidebarProps {
  user: User;
  locale: string;
}

const navItems = [
  { key: "agents" as const, href: "/" },
  { key: "settings" as const, href: "/settings" },
];

export function Sidebar({ user, locale }: SidebarProps) {
  const t = useTranslations("sidebar");
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-full w-60 flex-col border-r bg-white">
      {/* Logo */}
      <div className="flex h-14 items-center px-4 font-semibold text-lg">
        ClawHost
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-2">
        {navItems.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
              (item.href === "/"
                ? pathname === "/" || pathname.startsWith("/agents")
                : pathname === item.href)
                ? "bg-gray-100 text-gray-900"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            {t(item.key)}
          </Link>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="border-t p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground truncate">
            {user.name || user.email}
          </span>
          <LocaleSwitcher locale={locale} />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={handleLogout}
        >
          {t("logout")}
        </Button>
      </div>
    </aside>
  );
}
