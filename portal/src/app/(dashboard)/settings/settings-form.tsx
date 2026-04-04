"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { updateProfile, changePassword } from "@/lib/actions";
import type { User } from "@/types";

export function SettingsForm({ user }: { user: User }) {
  const t = useTranslations();
  const router = useRouter();
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  async function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProfileLoading(true);
    setProfileSuccess(false);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;

    const result = await updateProfile(name);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("settings.profileUpdated"));
      setProfileSuccess(true);
      router.refresh();
      // Reset success indicator after 3 seconds
      setTimeout(() => setProfileSuccess(false), 3000);
    }
    setProfileLoading(false);
  }

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordSuccess(false);

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
      setPasswordSuccess(true);
      (e.target as HTMLFormElement).reset();
      // Reset success indicator after 3 seconds
      setTimeout(() => setPasswordSuccess(false), 3000);
    }
    setPasswordLoading(false);
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">{t("settings.title")}</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="space-y-8">
        {/* Profile Section */}
        <Card className="border-border/50 bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">
              {t("settings.profile")}
            </CardTitle>
            <CardDescription className="text-base">
              Update your personal information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input
                  id="email"
                  value={user.email}
                  disabled
                  className="bg-muted/50 cursor-not-allowed"
                  aria-describedby="email-hint"
                />
                <p id="email-hint" className="text-sm text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">{t("auth.name")}</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={user.name}
                  placeholder={t("auth.namePlaceholder")}
                  required
                  className="focus:ring-2 focus:ring-ring/50"
                  aria-describedby="name-hint"
                />
                <p id="name-hint" className="text-sm text-muted-foreground">
                  Your display name shown in the application
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={profileLoading}
                  className="min-w-[120px]"
                >
                  {profileLoading ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="animate-spin h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span>Saving...</span>
                    </span>
                  ) : (
                    <span>{t("common.save")}</span>
                  )}
                </Button>
                {profileSuccess && (
                  <span className="flex items-center gap-2 text-base text-green-600 dark:text-green-400">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Saved
                  </span>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Change Password Section */}
        <Card className="border-border/50 bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">
              {t("settings.changePassword")}
            </CardTitle>
            <CardDescription className="text-base">
              Update your password to keep your account secure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="oldPassword">{t("settings.oldPassword")}</Label>
                <Input
                  id="oldPassword"
                  name="oldPassword"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="focus:ring-2 focus:ring-ring/50"
                  aria-describedby="oldPassword-hint"
                />
                <p id="oldPassword-hint" className="text-sm text-muted-foreground">
                  Enter your current password
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">{t("settings.newPassword")}</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  minLength={8}
                  required
                  autoComplete="new-password"
                  className="focus:ring-2 focus:ring-ring/50"
                  aria-describedby="newPassword-hint"
                />
                <p id="newPassword-hint" className="text-sm text-muted-foreground">
                  Must be at least 8 characters
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={passwordLoading}
                  className="min-w-[120px]"
                >
                  {passwordLoading ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="animate-spin h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span>Updating...</span>
                    </span>
                  ) : (
                    <span>{t("common.save")}</span>
                  )}
                </Button>
                {passwordSuccess && (
                  <span className="flex items-center gap-2 text-base text-green-600 dark:text-green-400">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Password updated
                  </span>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}