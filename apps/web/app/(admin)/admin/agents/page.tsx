import { AdminShell, AgentGovernancePanel } from "../_components"

export default function Page() {
  return (
    <AdminShell
      title="Agents"
      description="Agent onboarding, approval, availability, and retirement"
    >
      <AgentGovernancePanel />
    </AdminShell>
  )
}
