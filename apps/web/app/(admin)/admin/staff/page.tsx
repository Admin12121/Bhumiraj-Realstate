import {
  AdminShell,
  RequireStaffPermission,
  StaffGovernancePanel,
  StaffMembersPanel,
} from "../_components"

export default function Page() {
  return (
    <AdminShell
      title="Staff management"
      permission="admin.staff.read"
    >
      <div className="space-y-6">
        <StaffMembersPanel />
        <RequireStaffPermission permission="admin.staff.manage">
          <StaffGovernancePanel />
        </RequireStaffPermission>
      </div>
    </AdminShell>
  )
}
