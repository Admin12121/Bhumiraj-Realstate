import {
  AdminShell,
  StaffGovernancePanel,
  StaffMembersPanel,
} from "../_components"

export default function Page() {
  return (
    <AdminShell
      title="Staff management"
      description="Promote customers and assign custom operational roles."
    >
      <div className="space-y-6">
        <StaffMembersPanel />
        <StaffGovernancePanel />
      </div>
    </AdminShell>
  )
}
