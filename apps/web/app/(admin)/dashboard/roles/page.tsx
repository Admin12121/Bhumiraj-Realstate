import { AdminShell, StaffRolesPanel } from "../_components";

export default function Page() {
  return (
    // The editor fills the area under the header, so the page supplies its own
    // padding in list view rather than taking the shell's.
    <AdminShell title="Staff roles and permissions" permission="admin.roles.read" bleed>
      <StaffRolesPanel />
    </AdminShell>
  );
}
