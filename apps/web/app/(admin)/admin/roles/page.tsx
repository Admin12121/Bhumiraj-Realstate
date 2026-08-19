import { AdminShell, StaffRolesPanel } from "../_components";

export default function Page() {
  return (
    <AdminShell
      title="Staff roles and permissions"
      permission="admin.roles.read"
    >
      <StaffRolesPanel />
    </AdminShell>
  );
}
