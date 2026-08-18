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
        <h1 className="text-2xl font-semibold">Pay the listing fee</h1>
        <p className="mt-1 mb-6 text-sm text-slate-500">
          Your property is saved. Complete payment to send it for verification.
        </p>
        <ListingPaymentStep listingId={listingId} />
      </div>
    </MarketplacePageShell>
  );
}
