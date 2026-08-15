import { MarketplacePageShell } from "@/app/_components/marketplace-page-shell";
import { PropertyDetail } from "./_components";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <MarketplacePageShell>
      <PropertyDetail slug={slug} />
    </MarketplacePageShell>
  );
}
