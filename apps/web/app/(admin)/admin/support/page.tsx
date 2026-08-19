import type { Metadata } from "next";
import { AdminShell, SupportInbox } from "../_components";

export const metadata: Metadata = { title: "Support enquiries" };

export default function AdminSupportPage() {
  return (
    <AdminShell
      title="Support enquiries"
      permission="admin.support.read"
    >
      <SupportInbox />
    </AdminShell>
  );
}
