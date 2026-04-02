"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export default function RegisterPage() {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (password.length < 8) {
      toast.error(t("auth.passwordMin"));
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.message || t("auth.registerFailed"));
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      toast.error(t("auth.registerFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">ClawHost</CardTitle>
        <CardDescription>{t("auth.register")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("auth.name")}</Label>
            <Input
              id="name"
              name="name"
              placeholder={t("auth.namePlaceholder")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder={t("auth.emailPlaceholder")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder={t("auth.passwordPlaceholder")}
              minLength={8}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("common.loading") : t("auth.register")}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <span className="text-muted-foreground">{t("auth.hasAccount")}</span>
        <Link href="/login" className="ml-1 text-primary underline">
          {t("auth.goLogin")}
        </Link>
      </CardFooter>
    </Card>
  );
}
