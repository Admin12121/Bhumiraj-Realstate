import { AccountShell, SessionsCenter } from "../_components";

export default function SessionsPage() {
  return (
    <AccountShell
      title="Sessions"
      description="Review and revoke devices signed in to your account."
    >
      <SessionsCenter />
    </AccountShell>
  );
}