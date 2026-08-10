import { AccountShell } from "@/features/account/components/account-shell";
import { SessionsCenter } from "@/features/account/components/sessions-center";

export default function SessionsPage() {
  return (
    <AccountShell title="Sessions" description="Review and revoke devices signed in to your account.">
      <SessionsCenter />
    </AccountShell>
  );
}
