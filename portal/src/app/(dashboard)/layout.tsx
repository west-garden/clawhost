import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getProfile, listAgents, ApiError } from "@/lib/api";
import { AgentSidebar } from "@/components/agent-sidebar";
import { MobileHeader } from "@/components/mobile-header";

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
  const agents = await listAgents();

  return (
    <div className="flex h-screen glass-bg">
      <AgentSidebar agents={agents} user={user} locale={locale} />
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <MobileHeader agents={agents} user={user} locale={locale} />
        {children}
      </div>
    </div>
  );
}
