import type { Metadata } from "next";
import { AgentsDirectory } from "@/features/profiles/components/agents-directory";

export const metadata: Metadata = {
  title: "Verified Property Agents",
  description: "Find verified real-estate agents and view their active properties.",
};

export default function AgentsPage() {
  return <AgentsDirectory />;
}
