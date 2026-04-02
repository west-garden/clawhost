"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthed, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthed) {
      router.replace("/login");
    } else if (!loading && user && user.role !== "admin") {
      router.replace("/login?error=forbidden");
    }
  }, [loading, isAuthed, user, router]);

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