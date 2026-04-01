import { getProfile } from "@/lib/api";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const user = await getProfile();

  return <SettingsForm user={user} />;
}
