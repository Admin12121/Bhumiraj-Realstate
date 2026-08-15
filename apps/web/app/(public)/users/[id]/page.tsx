import { MarketplacePageShell } from "@/app/_components/marketplace-page-shell";
import { PublicProfile } from "../../_components";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <MarketplacePageShell>
      <PublicProfile id={id} />
    </MarketplacePageShell>
  );
}
