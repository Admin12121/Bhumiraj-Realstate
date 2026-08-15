import { AdminAuctionsTable, AdminShell } from "../_components";

export default function Page() {
  return (
    <AdminShell
      title="Auctions"
      description="Monitor live bidding and auction settlement."
      permission="admin.auctions.read"
    >
      <AdminAuctionsTable />
    </AdminShell>
  );
}