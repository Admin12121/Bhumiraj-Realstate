import { AdminShell } from "../_components";
import { AgentGovernancePanel } from "./_components";

export default function Page() {
  return (
    <AdminShell
      title="Agents"
      permission="admin.agents.read"
    >
      <AgentGovernancePanel />
    </AdminShell>
  )
}
