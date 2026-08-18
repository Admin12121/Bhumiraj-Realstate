import { PublicHeader, SiteFooter } from "@/app/_components";
import { AgentProfile } from "../../_components";

export default async function Page({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return (
    <>
      <PublicHeader />
      <main className="bg-white pt-[72px]">
        <AgentProfile userId={userId} />
      </main>
      <SiteFooter />
    </>
  );
}
