"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bath,
  BedDouble,
  Bookmark,
  Camera,
  CarFront,
  CheckCircle2,
  Clock3,
  LandPlot,
  MapPin,
  MoreHorizontal,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@real-estate/auth/client";
import type { ListingCard } from "@real-estate/contracts";
import { z } from "zod";
import { toast } from "sonner";
import { apiRequest } from "@/shared/http/api";
import { queryKeys } from "@/shared/query/query-keys";
import { formatMinorAmount } from "@/shared/utilities/money";

const favoriteResponseSchema = z.object({ saved: z.boolean() });

function listingDate(value: string | null): string {
  if (!value) return "Recently added";
  return new Intl.DateTimeFormat("en-NP", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function PropertyCard({ listing }: { listing: ListingCard }) {
  const router = useRouter();
  const session = useSession();
  const queryClient = useQueryClient();
  const destination = listing.auction
    ? `/auctions/${listing.auction.id}`
    : `/properties/${listing.slug}`;

  const favorite = useMutation({
    mutationFn: (shouldSave: boolean) =>
      apiRequest(`/favorites/${listing.id}`, {
        method: shouldSave ? "POST" : "DELETE",
        schema: favoriteResponseSchema,
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.listings.all });
      void queryClient.invalidateQueries({ queryKey: ["favorites"] });
      toast.success(
        result.saved ? "Property saved" : "Removed from saved properties",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saved = favorite.data?.saved ?? listing.isSaved;
  // A listing carries no agent until one accepts the offer.
  const agent = listing.agent;
  const agentHref = agent ? `/users/${agent.id}` : `/properties/${listing.slug}`;
  const price = listing.auction
    ? formatMinorAmount(listing.auction.currentAmountMinor, "NPR")
    : listing.price
      ? formatMinorAmount(listing.price.amountMinor, listing.price.currency)
      : "Contact agent";

  function toggleFavorite() {
    if (!session.data) {
      router.push(`/sign-in?callbackURL=${encodeURIComponent(destination)}`);
      return;
    }
    favorite.mutate(!saved);
  }

  return (
    <article
      className="surface overflow-hidden rounded-[24px] p-3.5"
      data-testid="property-card"
    >
      <div className="mb-3 flex items-center gap-3 px-1">
        <Link
          href={agentHref}
          className="relative size-10 shrink-0 overflow-hidden rounded-full bg-emerald-100"
          aria-label={agent ? `View ${agent.name}'s profile` : undefined}
        >
          <Image
            src={agent?.image || "/assets/category-house.svg"}
            fill
            alt=""
            sizes="40px"
            className="object-cover"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={agentHref}
            className="flex items-center gap-1.5 font-semibold hover:text-emerald-800"
          >
            {agent?.name ?? "Bhumiraj Estates"}
            {agent?.verified && (
              <CheckCircle2 className="size-4 fill-blue-500 text-white" />
            )}
          </Link>
          <div className="text-xs text-slate-500">
            {listingDate(listing.publishedAt)} Â· {listing.location.locality},{" "}
            {listing.location.district}
          </div>
        </div>
        <span
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            listing.auction
              ? "bg-amber-50 text-amber-700"
              : "bg-emerald-700 text-white"
          }`}
        >
          {listing.auction ? "Live Auction" : "New Listing"}
        </span>
        <button
          type="button"
          aria-label="More property actions"
          className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
        >
          <MoreHorizontal className="size-5" />
        </button>
      </div>

      <Link
        href={destination}
        className="relative block aspect-[16/8.2] overflow-hidden rounded-2xl bg-slate-100"
      >
        <Image
          src={listing.coverImageUrl || "/assets/property-modern.svg"}
          alt={listing.title}
          fill
          sizes="(max-width: 900px) 100vw, 680px"
          className="object-cover transition-transform duration-500 hover:scale-[1.02]"
        />
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-2.5 py-1.5 text-xs font-semibold shadow">
          <Camera className="size-3.5" />
          {listing.imageCount} {listing.imageCount === 1 ? "Photo" : "Photos"}
        </span>
        {listing.auction && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-bold text-white">
            <span className="live-dot size-2 rounded-full bg-white" /> LIVE
          </span>
        )}
      </Link>

      <div className="px-1 pb-1 pt-3">
        <div className="flex items-start justify-between gap-5">
          <h2 className="text-[18px] font-semibold leading-tight">
            <Link href={destination} className="hover:text-emerald-800">
              {listing.title}
            </Link>
          </h2>
          <p className="shrink-0 text-[17px] font-semibold text-emerald-800">
            {price}
          </p>
        </div>

        {listing.auction && (
          <div className="mt-1 flex justify-end gap-3 text-xs text-slate-500">
            <span>{listing.auction.bidCount} bids</span>
            <span className="flex items-center gap-1">
              <Clock3 className="size-3.5" />
              Ends {new Date(listing.auction.endsAt).toLocaleString("en-NP")}
            </span>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <BedDouble className="size-4" />
            {listing.specifications.bedrooms ?? "—"} Beds
          </span>
          <span className="flex items-center gap-1.5">
            <Bath className="size-4" />
            {listing.specifications.bathrooms ?? "—"} Baths
          </span>
          <span className="flex items-center gap-1.5">
            <LandPlot className="size-4" />
            {listing.specifications.areaSqFt?.toLocaleString() ?? "—"} sq. ft.
          </span>
          <span className="flex items-center gap-1.5">
            <CarFront className="size-4" />
            {listing.specifications.parkingSpaces ?? 0} Parking
          </span>
        </div>

        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
          {listing.description}
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
            <span className="rounded-full bg-slate-50 px-2.5 py-1">
              <MapPin className="mr-1 inline size-3" />
              {listing.location.locality}
            </span>
            {listing.isVerified && (
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
                <CheckCircle2 className="mr-1 inline size-3" />
                Verified
              </span>
            )}
          </div>
          <button
            type="button"
            aria-label={saved ? "Remove saved property" : "Save property"}
            aria-pressed={saved}
            disabled={favorite.isPending}
            onClick={toggleFavorite}
            className="rounded-full border p-2 text-slate-500 hover:border-emerald-600 hover:text-emerald-700 disabled:opacity-60"
          >
            <Bookmark
              className={`size-4 ${saved ? "fill-emerald-700 text-emerald-700" : ""}`}
            />
          </button>
        </div>
      </div>
    </article>
  );
}
