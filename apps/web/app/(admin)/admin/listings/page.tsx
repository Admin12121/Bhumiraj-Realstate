import { AdminListingsTable, AdminShell } from "../_components";

export default function Page() {
  return (
    <AdminShell
      title="Listings"
      permission="admin.listings.read"
    >
      <AdminListingsTable />
    </AdminShell>
  );
}