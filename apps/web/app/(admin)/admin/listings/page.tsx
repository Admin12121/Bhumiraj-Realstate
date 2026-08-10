import { AdminShell } from "@/features/admin/components/admin-shell";import { AdminListingsTable } from "@/features/admin/components/admin-listings-table";
export default function Page(){return <AdminShell title="Listings" description="Review, publish and moderate property listings."><AdminListingsTable/></AdminShell>}
