import type { Metadata } from "next";
import { AdminShell } from "../../_components";
import { PostPropertyWizard } from "@/app/(account)/post-property/_components";

export const metadata: Metadata = { title: "New auction" };

export default function Page() {
  return (
    <AdminShell title="New auction" permission="admin.auctions.manage">
      <PostPropertyWizard mode="auction" />
    </AdminShell>
  );
}
