import type { Metadata } from "next";
import { AccountShell, AccountOverview } from "./_components";

export const metadata: Metadata = { title: "Account" };

export default function Page() {
  return (
    <AccountShell
      title="Your account"
      description="Everything you have saved, listed and arranged on Bhumiraj."
    >
      <AccountOverview />
    </AccountShell>
  );
}
