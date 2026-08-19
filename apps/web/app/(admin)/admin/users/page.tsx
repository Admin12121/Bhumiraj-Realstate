import { AdminShell, AdminUsersTable } from "../_components";

export default function Page() {
  return (
    <AdminShell
      title="User management"
      permission="admin.users.read"
    >
      <AdminUsersTable />
    </AdminShell>
  );
}
