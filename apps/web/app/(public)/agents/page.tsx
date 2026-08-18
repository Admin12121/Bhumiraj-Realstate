import type { Metadata } from "next";
import { PublicHeader, SiteFooter } from "@/app/_components";
import { AgentsDirectory } from "../_components";

export const metadata: Metadata = {
  title: "Verified Property Agents",
  description:
    "Find verified real-estate agents and view their active properties.",
};

export default function AgentsPage() {
  return (
    <>
      <PublicHeader />
      <main className="bg-white pt-[72px]">
        <AgentsDirectory />
      </main>
      <SiteFooter />
    </>
  );
}
