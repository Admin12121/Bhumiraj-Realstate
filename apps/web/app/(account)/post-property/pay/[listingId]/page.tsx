import type { Metadata } from "next";
import { MarketplacePageShell } from "@/app/_components/marketplace-page-shell";
import { ListingPaymentStep } from "../../_components/listing-payment-step";

export const metadata: Metadata = { title: "Pay listing fee" };

export default async function Page({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;
  return (
    <MarketplacePageShell>
      <div className="mx-auto w-full max-w-2xl px-5 py-10">
        <ListingPaymentStep listingId={listingId} />
      </div>
    </MarketplacePageShell>
  );
}
