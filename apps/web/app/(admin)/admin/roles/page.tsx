import { AdminShell, StaffRolesPanel } from "../_components";

export default function Page() {
  return (
    <AdminShell
      title="Staff roles and permissions"
      description="Create role templates, set hierarchy, and grant registered permissions."
      permission="admin.roles.read"
    >
      <StaffRolesPanel />
    </AdminShell>
  );
}
