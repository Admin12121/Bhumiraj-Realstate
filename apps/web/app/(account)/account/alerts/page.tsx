import { AccountShell, AlertsCenter } from "../_components";

export default function Page() {
  return (
    <AccountShell
      title="Search alerts"
      description="Saved searches and new-property notifications."
    >
      <AlertsCenter />
    </AccountShell>
  );
}