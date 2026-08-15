"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bath,
  BedDouble,
  Bookmark,
  CheckCircle2,
  LandPlot,
  MapPin,
  MessageCircle,
  Share2,
  UserRound,
} from "lucide-react";
import { useSession } from "@real-estate/auth/client";
import type { ListingDetail } from "@real-estate/contracts";
import { z } from "zod";
import { toast } from "sonner";
import { apiRequest } from "@/shared/http/api";
import { queryKeys } from "@/shared/query/query-keys";
import { formatMinorAmount } from "@/shared/utilities/money";
import { startConversation } from "@/features/profiles/api/profiles-api";
import {
  getListingDetail,
  recordListingView,
} from "@/features/listings/api/listing-detail-api";

const favoriteResponseSchema = z.object({ saved: z.boolean() });

export function PropertyDetail({ slug }: { slug: string }) {
  const router = useRouter();
  const session = useSession();
  const queryClient = useQueryClient();
  const detailKey = queryKeys.listings.detail(slug);

  const query = useQuery({
    queryKey: detailKey,
    queryFn: ({ signal }) => getListingDetail(slug, signal),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!query.data?.id) return;
    void recordListingView(query.data.id).catch(() => undefined);
  }, [query.data?.id]);

  const favorite = useMutation({
    mutationFn: async (listing: ListingDetail) =>
      apiRequest(`/favorites/${listing.id}`, {
        method: listing.isSaved ? "DELETE" : "POST",
        schema: favoriteResponseSchema,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData<ListingDetail>(detailKey, (current) =>
        current ? { ...current, isSaved: result.saved } : current,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.listings.all });
      void queryClient.invalidateQueries({ queryKey: ["favorites"] });
      toast.success(
        result.saved ? "Property saved" : "Removed from saved properties",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const message = useMutation({
    mutationFn: (listing: ListingDetail) =>
      startConversation({
        participantId: listing.agent.id,
        listingId: listing.id,
        message: `Hello, I am interested in â€œ${listing.title}â€.`,
      }),
    onSuccess: (conversation) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.all,
      });
      router.push(`/account/messages?conversation=${conversation.id}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function requireSession(): boolean {
    if (session.data) return true;
    router.push(
      `/sign-in?callbackURL=${encodeURIComponent(`/properties/${slug}`)}`,
    );
    return false;
  }

  function toggleFavorite(listing: ListingDetail) {
    if (!requireSession()) return;
    favorite.mutate(listing);
  }

  function contactAgent(listing: ListingDetail) {
    if (!requireSession()) return;
    if (session.data?.user.id === listing.agent.id) {
      toast.info("This is your own listing.");
      return;
    }
    message.mutate(listing);
  }

  async function shareListing(listing: ListingDetail) {
    const url = globalThis.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: listing.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Property link copied");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Unable to share this property.");
    }
  }

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-7xl p-8 text-sm text-slate-500">
        Loading propertyâ€¦
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-7xl p-8 text-sm text-slate-500">
        Property not found.
      </div>
    );
  }

  const listing = query.data;
  const price = listing.price
    ? formatMinorAmount(listing.price.amountMinor, listing.price.currency)
    : listing.auction
      ? formatMinorAmount(listing.auction.currentAmountMinor, "NPR")
      : "Contact agent";
  const gallery = listing.media.slice(1, 5);
  const fallbackGallery = Array.from({ length: 4 }, (_, index) => ({
    id: `fallback-${index}`,
    url: "/assets/property-modern.svg",
    altText: null,
    position: index,
  }));

  return (
    <main id="main-content" className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link
            href="/"
            className="font-serif text-xl font-bold text-emerald-800"
          >
            BHUMIRAJ ESTATES
          </Link>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Share property"
              onClick={() => void shareListing(listing)}
              className="rounded-full border p-2.5 hover:border-emerald-600 hover:text-emerald-700"
            >
              <Share2 className="size-4" />
            </button>
            <button
              type="button"
              aria-label={listing.isSaved ? "Remove saved property" : "Save property"}
              onClick={() => toggleFavorite(listing)}
              disabled={favorite.isPending}
              className="rounded-full border p-2.5 hover:border-emerald-600 hover:text-emerald-700 disabled:opacity-60"
            >
              <Bookmark
                className={`size-4 ${listing.isSaved ? "fill-emerald-700 text-emerald-700" : ""}`}
              />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-7">
        <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
          <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-slate-100">
            <Image
              src={listing.media[0]?.url ?? "/assets/property-modern.svg"}
              fill
              priority
              alt={listing.media[0]?.altText ?? listing.title}
              sizes="(max-width: 1024px) 100vw, 850px"
              className="object-cover"
            />
          </div>
          <div className="grid min-h-64 grid-cols-2 gap-3">
            {(gallery.length ? gallery : fallbackGallery).map((image) => (
              <div
                key={image.id}
                className="relative min-h-32 overflow-hidden rounded-2xl bg-slate-100"
              >
                <Image
                  src={image.url}
                  fill
                  alt={image.altText ?? listing.title}
                  sizes="(max-width: 1024px) 50vw, 210px"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="space-y-5">
            <div className="surface rounded-2xl p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">
                      {listing.title}
                    </h1>
                    {listing.isVerified && (
                      <CheckCircle2 className="size-5 fill-blue-500 text-white" />
                    )}
                  </div>
                  <p className="mt-2 flex items-center gap-1 text-sm text-slate-500">
                    <MapPin className="size-4" />
                    {listing.address.locality}, {listing.address.municipality},{" "}
                    {listing.address.district}
                  </p>
                </div>
                <p className="text-2xl font-bold text-emerald-800">{price}</p>
              </div>

              <div className="mt-6 flex flex-wrap gap-6 border-y py-4 text-sm">
                <span className="flex gap-2">
                  <BedDouble className="size-5 text-emerald-700" />
                  {listing.specifications.bedrooms ?? "â€”"} bedrooms
                </span>
                <span className="flex gap-2">
                  <Bath className="size-5 text-emerald-700" />
                  {listing.specifications.bathrooms ?? "â€”"} bathrooms
                </span>
                <span className="flex gap-2">
                  <LandPlot className="size-5 text-emerald-700" />
                  {listing.specifications.areaSqFt?.toLocaleString() ?? "â€”"} sq. ft.
                </span>
              </div>

              <h2 className="mt-6 text-lg font-semibold">Property description</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">
                {listing.description}
              </p>
            </div>

            <div className="surface rounded-2xl p-6">
              <h2 className="text-lg font-semibold">Amenities</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {listing.amenities.length ? (
                  listing.amenities.map((amenity) => (
                    <span
                      key={amenity.id}
                      className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800"
                    >
                      {amenity.name}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">
                    No amenities provided.
                  </span>
                )}
              </div>
            </div>
          </section>

          <aside className="surface h-fit rounded-2xl p-5">
            <Link
              href={`/users/${listing.agent.id}`}
              className="flex items-center gap-3 rounded-xl p-1 hover:bg-slate-50"
            >
              <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-50 font-semibold text-emerald-800">
                {listing.agent.image ? (
                  <Image
                    src={listing.agent.image}
                    fill
                    alt={`${listing.agent.name} profile`}
                    sizes="48px"
                    className="object-cover"
                  />
                ) : (
                  listing.agent.name.slice(0, 1).toUpperCase()
                )}
              </span>
              <span>
                <span className="block font-semibold">{listing.agent.name}</span>
                <span className="text-xs text-slate-500">
                  {listing.agent.verified
                    ? "Verified property agent"
                    : "Property seller"}
                </span>
              </span>
            </Link>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => contactAgent(listing)}
                disabled={message.isPending}
                className="brand-button flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-60"
              >
                <MessageCircle className="size-4" />
                Message
              </button>
              <Link
                href={`/users/${listing.agent.id}`}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-700 text-sm font-semibold text-emerald-800"
              >
                <UserRound className="size-4" />
                Profile
              </Link>
            </div>

            {listing.auction && (
              <Link
                href={`/auctions/${listing.auction.id}`}
                className="mt-3 block rounded-xl bg-amber-500 px-4 py-3 text-center text-sm font-bold text-white"
              >
                Join live auction
              </Link>
            )}

            <p className="mt-4 text-xs leading-5 text-slate-500">
              Never transfer money outside the platform without verifying the
              owner, property documents and transaction terms.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
