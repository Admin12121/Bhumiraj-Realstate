import type { Metadata } from "next";
import { AdminShell } from "../_components";
import { SupportInbox } from "./_components";

export const metadata: Metadata = { title: "Support enquiries" };

export default function AdminSupportPage() {
  return (
    <AdminShell
      bleed
      title="Support enquiries"
      permission="admin.support.read"
    >
      <SupportInbox />
    </AdminShell>
  );
}
