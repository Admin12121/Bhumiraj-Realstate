import type { Metadata } from "next";
import { SupportInbox } from "../_components";

export const metadata: Metadata = { title: "Support enquiries" };

export default function AdminSupportPage() {
  return <SupportInbox />;
}
