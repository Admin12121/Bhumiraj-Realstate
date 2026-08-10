import { AdminShell } from "@/features/admin/components/admin-shell";import { AdminAuctionsTable } from "@/features/admin/components/admin-auctions-table";
export default function Page(){return <AdminShell title="Auctions" description="Monitor live bidding and auction settlement."><AdminAuctionsTable/></AdminShell>}
