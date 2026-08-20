import type { Metadata } from "next";
import { AccountShell } from "../_components";
import { AccountSettingsTabs } from "@/features/account/components/account-settings-tabs";

export const metadata: Metadata = { title: "Settings" };

const TABS = ["profile", "security", "sessions", "passkeys"];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const initialTab = tab && TABS.includes(tab) ? tab : "profile";

  return (
    <AccountShell
      title="Settings"
      description="Your profile, how the account is protected, and where you are signed in."
    >
      <AccountSettingsTabs initialTab={initialTab} />
    </AccountShell>
  );
}
