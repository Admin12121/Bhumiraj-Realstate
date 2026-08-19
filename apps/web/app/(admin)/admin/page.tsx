import { AdminOverview, AdminShell } from "./_components";

export default function AdminPage() {
  return (
    <AdminShell
      title="Platform overview"
      permission="admin.overview.read"
    >
      <AdminOverview />
    </AdminShell>
  );
}