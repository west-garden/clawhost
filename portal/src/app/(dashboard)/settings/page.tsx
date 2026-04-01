"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { updateProfile, changePassword } from "@/lib/actions";

export default function SettingsPage() {
  const t = useTranslations();
  const router = useRouter();
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  async function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProfileLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;

    const result = await updateProfile(name);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("settings.profileUpdated"));
      router.refresh();
    }
    setProfileLoading(false);
  }

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordLoading(true);

    const formData = new FormData(e.currentTarget);
    const oldPassword = formData.get("oldPassword") as string;
    const newPassword = formData.get("newPassword") as string;

    if (newPassword.length < 8) {
      toast.error(t("auth.passwordMin"));
      setPasswordLoading(false);
      return;
    }

    const result = await changePassword(oldPassword, newPassword);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("settings.passwordChanged"));
      (e.target as HTMLFormElement).reset();
    }
    setPasswordLoading(false);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">{t("settings.title")}</h1>

      <div className="space-y-6">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("settings.profile")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("auth.name")}</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder={t("auth.namePlaceholder")}
                  required
                />
              </div>
              <Button type="submit" disabled={profileLoading}>
                {profileLoading ? t("common.loading") : t("common.save")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Separator />

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("settings.changePassword")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="oldPassword">
                  {t("settings.oldPassword")}
                </Label>
                <Input
                  id="oldPassword"
                  name="oldPassword"
                  type="password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">
                  {t("settings.newPassword")}
                </Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  minLength={8}
                  required
                />
              </div>
              <Button type="submit" disabled={passwordLoading}>
                {passwordLoading ? t("common.loading") : t("common.save")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
