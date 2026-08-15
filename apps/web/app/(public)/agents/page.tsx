import type { Metadata } from "next";
import { MarketplacePageShell } from "@/app/_components/marketplace-page-shell";
import { AgentsDirectory } from "../_components";

export const metadata: Metadata = {
  title: "Verified Property Agents",
  description:
    "Find verified real-estate agents and view their active properties.",
};

export default function AgentsPage() {
  return (
    <MarketplacePageShell>
      <AgentsDirectory />
    </MarketplacePageShell>
  );
}
