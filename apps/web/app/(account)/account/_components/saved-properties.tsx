"use client";

import Image from "next/image";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { InfiniteScrollTrigger } from "@/shared/components/infinite-scroll-trigger";
import { apiRequest } from "@/shared/http/api";
import { formatOptionalMinorAmount } from "@/shared/utilities/money";

const favoriteFeedSchema = z.object({
  items: z.array(
    z.object({
      listing: z.object({
        id: z.string(),
        slug: z.string(),
        title: z.string(),
        priceMinor: z.string().nullable(),
        currency: z.string().default("NPR"),
        coverImageKey: z.string().nullable(),
        property: z.object({
          address: z.object({ locality: z.string(), district: z.string() }),
        }),
      }),
    }),
  ),
  hasMore: z.boolean(),
  nextCursor: z.string().nullable(),
});

export function SavedProperties() {
  const query = useInfiniteQuery({
    queryKey: ["favorites"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => {
      const parameters = new URLSearchParams({ limit: "20" });
      if (pageParam) parameters.set("cursor", pageParam);
      return apiRequest(`/favorites?${parameters}`, {
        method: "GET",
        schema: favoriteFeedSchema,
        signal,
      });
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const cdnBase = process.env.NEXT_PUBLIC_CDN_BASE_URL?.replace(/\/$/, "");

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map(({ listing }) => (
        <Link
          key={listing.id}
          href={`/properties/${listing.slug}`}
          className="surface overflow-hidden rounded-2xl"
        >
          <div className="relative aspect-[16/9] bg-slate-100">
            <Image
              src={
                listing.coverImageKey && cdnBase
                  ? `${cdnBase}/${listing.coverImageKey}`
                  : "/assets/property-modern.svg"
              }
              fill
              alt={listing.title}
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 50vw"
            />
          </div>
          <div className="p-4">
            <h2 className="font-semibold">{listing.title}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {listing.property.address.locality}, {listing.property.address.district}
            </p>
            <p className="mt-3 font-semibold text-emerald-800">
              {formatOptionalMinorAmount(
                listing.priceMinor,
                listing.currency,
              )}
            </p>
          </div>
        </Link>
      ))}

      {!items.length && !query.isLoading && (
        <div className="surface col-span-full rounded-2xl p-10 text-center text-sm text-slate-500">
          No saved properties yet.
        </div>
      )}

      <InfiniteScrollTrigger
        hasNextPage={Boolean(query.hasNextPage)}
        isFetchingNextPage={query.isFetchingNextPage}
        fetchNextPage={query.fetchNextPage}
        label="Loading saved propertiesâ€¦"
      />
    </div>
  );
}
