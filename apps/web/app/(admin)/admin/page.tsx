import { AdminOverview, AdminShell } from "./_components";

export default function AdminPage() {
  return (
    <AdminShell
      title="Platform overview"
      description="Operational health and marketplace activity."
      permission="admin.overview.read"
    >
      <AdminOverview />
    </AdminShell>
  );
}