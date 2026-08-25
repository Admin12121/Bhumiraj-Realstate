import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AdminAuctionsTable, AdminShell } from "../_components";
import { Button } from "@/components/ui/button";
import { RequireStaffPermission } from "../_components/admin-shell";

export const metadata: Metadata = { title: "Auctions" };

export default function Page() {
  return (
    <AdminShell title="Auctions" permission="admin.auctions.read">
      <AdminAuctionsTable
        newAuctionAction={
          <RequireStaffPermission
            permission="admin.auctions.manage"
            fallback={null}
          >
            <Button
              render={<Link href="/dashboard/auctions/new" />}
              size="icon"
              aria-label="New auction"
            >
              <Plus />
            </Button>
          </RequireStaffPermission>
        }
      />
    </AdminShell>
  );
}
