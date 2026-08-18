import type { Metadata } from "next";
import { PaymentVerificationPanel } from "../_components";

export const metadata: Metadata = { title: "Listing payments" };

export default function AdminPaymentsPage() {
  return <PaymentVerificationPanel />;
}
