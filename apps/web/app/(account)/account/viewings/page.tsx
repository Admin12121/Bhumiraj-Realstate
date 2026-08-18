import type { Metadata } from "next";
import { AccountShell, AgentViewingsPanel } from "../_components";

export const metadata: Metadata = { title: "Viewings" };

export default function Page() {
  return (
    <AccountShell
      title="Viewings"
      description="Requests from buyers, your confirmed appointments, and the hours you are available."
    >
      <AgentViewingsPanel />
    </AccountShell>
  );
}
