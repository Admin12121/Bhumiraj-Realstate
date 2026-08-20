import {
  AdminShell,
  RequireStaffPermission,
  StaffGovernancePanel,
  StaffMembersPanel,
} from "../_components"

export default function Page() {
  return (
    // Full bleed because selecting a member opens a full-height editor; the
    // list view supplies its own padding.
    <AdminShell title="Staff management" permission="admin.staff.read" bleed>
      <StaffMembersPanel
        listFooter={
          <RequireStaffPermission permission="admin.staff.manage">
            <StaffGovernancePanel />
          </RequireStaffPermission>
        }
      />
    </AdminShell>
  )
}
