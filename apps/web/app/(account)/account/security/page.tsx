import { AccountShell, SecurityCenter } from "../_components";

export default function Page() {
  return (
    <AccountShell
      title="Security"
      description="Manage two-factor authentication, passkeys, sessions and account lifecycle."
    >
      <SecurityCenter />
    </AccountShell>
  );
}