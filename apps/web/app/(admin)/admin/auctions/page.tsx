import { AdminAuctionsTable, AdminShell } from "../_components";

export default function Page() {
  return (
    <AdminShell
      title="Auctions"
      permission="admin.auctions.read"
    >
      <AdminAuctionsTable />
    </AdminShell>
  );
}