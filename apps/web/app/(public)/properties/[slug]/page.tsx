import { MarketplacePageShell } from "@/app/_components/marketplace-page-shell";
import { findDemoResidence } from "@/app/_components/demo-residences";
import { StayPage } from "./_components/stay-page";
import { PropertyDetail } from "./_components";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Demo slugs render the ported reference layout; everything else hits the API.
  const demo = findDemoResidence(slug);
  if (demo) return <StayPage residence={demo} />;

  return (
    <MarketplacePageShell>
      <PropertyDetail slug={slug} />
    </MarketplacePageShell>
  );
}
