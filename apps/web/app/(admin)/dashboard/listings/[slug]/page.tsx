import type { Metadata } from "next";
import { AdminShell } from "../../_components";
import { AdminListingDetailView } from "../_components/admin-listing-detail";

export const metadata: Metadata = { title: "Listing" };

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <AdminShell title="Listing" permission="admin.listings.read">
      <AdminListingDetailView slug={slug} />
    </AdminShell>
  );
}
