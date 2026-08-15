import { AdminShell, AdminUsersTable } from "../_components";

export default function Page() {
  return (
    <AdminShell
      title="User management"
      description="Customer and agent account types, security status and lifecycle."
    >
      <AdminUsersTable />
    </AdminShell>
  );
}
