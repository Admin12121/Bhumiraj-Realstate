import { AdminListingsTable, AdminShell } from "../_components";

export default function Page() {
  return (
    <AdminShell
      title="Listings"
      description="Review, publish and moderate property listings."
      permission="admin.listings.read"
    >
      <AdminListingsTable />
    </AdminShell>
  );
}