import { AdminShell } from "@/features/admin/components/admin-shell";
import { AdminOverview } from "@/features/admin/components/admin-overview";

export default function AdminPage() {
  return (
    <AdminShell
      title="Platform overview"
      description="Operational health and marketplace activity."
    >
      <AdminOverview />
    </AdminShell>
  );
}
