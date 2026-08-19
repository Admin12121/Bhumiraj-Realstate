import type { Metadata } from "next";
import { AdminShell, PaymentVerificationPanel } from "../_components";

export const metadata: Metadata = { title: "Listing payments" };

export default function AdminPaymentsPage() {
  return (
    <AdminShell
      title="Listing payments"
      permission="admin.payments.read"
    >
      <PaymentVerificationPanel />
    </AdminShell>
  );
}
