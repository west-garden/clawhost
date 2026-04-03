"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Code2, Mail } from "lucide-react";

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.message || t("auth.loginFailed"));
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      toast.error(t("auth.loginFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-card-header">
        <h1 className="auth-card-title">ClawHost</h1>
        <p className="auth-card-description">{t("auth.login")}</p>
      </div>

      <div className="auth-card-content">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder={t("auth.emailPlaceholder")}
              required
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder={t("auth.passwordPlaceholder")}
              required
              className="h-11"
            />
          </div>
          <Button
            type="submit"
            className="w-full h-11 bg-gradient-to-r from-[oklch(0.58_0.24_20)] to-[oklch(0.48_0.22_30)] hover:from-[oklch(0.60_0.24_20)] hover:to-[oklch(0.50_0.22_30)] text-white font-semibold shadow-md hover:shadow-lg transition-all"
            disabled={loading}
          >
            {loading ? t("common.loading") : t("auth.login")}
          </Button>
        </form>

        <div className="auth-divider">
          <span>{t("auth.orSeparator")}</span>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            className="oauth-btn"
            onClick={() => (window.location.href = "/api/auth/oauth/github")}
          >
            <Code2 className="w-5 h-5" />
            <span>{t("auth.loginWithGithub")}</span>
          </button>
          <button
            type="button"
            className="oauth-btn"
            onClick={() => (window.location.href = "/api/auth/oauth/google")}
          >
            <Mail className="w-5 h-5" />
            <span>{t("auth.loginWithGoogle")}</span>
          </button>
        </div>
      </div>

      <div className="auth-card-footer">
        <span className="text-muted-foreground">{t("auth.noAccount")}</span>
        <Link href="/register" className="ml-1.5 text-primary font-medium hover:underline">
          {t("auth.goRegister")}
        </Link>
      </div>
    </div>
  );
}