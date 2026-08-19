import { PublicHeader, SiteFooter } from "@/app/_components";
import { AgentProfile } from "../../_components";

export default async function Page({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  return (
    <>
      <PublicHeader />
      <AgentProfile handle={handle} />
      <SiteFooter />
    </>
  );
}
