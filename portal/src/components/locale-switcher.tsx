"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LocaleSwitcher({ locale }: { locale: string }) {
  const router = useRouter();

  function toggleLocale() {
    const next = locale === "zh" ? "en" : "zh";
    document.cookie = `locale=${next};path=/;max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggleLocale}>
      {locale === "zh" ? "EN" : "中文"}
    </Button>
  );
}
