import { AccountShell, ConnectedAccounts, SecurityCenter } from "../_components";

export default function Page() {
  return (
    <AccountShell
      title="Security"
      description="Manage two-factor authentication, passkeys, connected accounts and sessions."
    >
      <div className="space-y-6">
        <SecurityCenter />
        <ConnectedAccounts />
      </div>
    </AccountShell>
  );
}
