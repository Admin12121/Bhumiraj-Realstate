import type { Metadata } from "next";
import { AdminShell } from "../_components";
import { TicketsPanel } from "./_components";

export const metadata: Metadata = { title: "Tickets" };

export default function Page() {
  return (
    <AdminShell bleed title="Tickets" permission="admin.moderation.read">
      <TicketsPanel />
    </AdminShell>
  );
}
