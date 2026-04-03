"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthed, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Skip guard on login page
  const isLoginPage = pathname === "/login" || pathname === "/login/";

  useEffect(() => {
    if (isLoginPage) return;
    if (!loading && !isAuthed) {
      router.replace("/login");
    } else if (!loading && user && user.role !== "admin") {
      router.replace("/login?error=forbidden");
    }
  }, [loading, isAuthed, user, router, isLoginPage]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthed || (user && user.role !== "admin")) {
    return null;
  }

  return <>{children}</>;
}