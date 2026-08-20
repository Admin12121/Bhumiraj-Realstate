import type { Metadata } from "next";
import { AccountShell, AccountOverview } from "./_components";

export const metadata: Metadata = { title: "Account" };

export default function Page() {
  return (
    <AccountShell
      title="Your account"
    >
      <AccountOverview />
    </AccountShell>
  );
}
