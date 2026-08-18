import type { Metadata } from "next";
import { AccountShell, AgentAssignmentsPanel } from "../_components";

export const metadata: Metadata = { title: "Property offers" };

export default function Page() {
  return (
    <AccountShell
      title="Property offers"
      description="Properties the platform has offered you, and the ones you already represent."
    >
      <AgentAssignmentsPanel />
    </AccountShell>
  );
}
