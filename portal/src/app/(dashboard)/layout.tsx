import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getProfile } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { ApiError } from "@/lib/api";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  try {
    user = await getProfile();
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      redirect("/login");
    }
    throw e;
  }

  const locale = await getLocale();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar user={user} locale={locale} />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl p-6">{children}</div>
      </main>
    </div>
  );
}
