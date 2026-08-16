"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ListingFeedQuery } from "@real-estate/contracts"
import { DEMO_RESIDENCES } from "@/app/_components/demo-residences"
import { PublicHeader } from "@/app/_components/public-header"
import { useListingFeed } from "@/features/listings/queries/use-listing-feed"
import { formatMinorAmount } from "@/shared/utilities/money"
import {
  MapSurface,
  type MapBounds,
  type MapMarkerData,
} from "./map-surface"
import { SearchHeaderControls } from "./search-header-controls"
import { ResultCard, type SearchResult } from "./result-card"

/** Cards revealed per infinite-scroll batch. */
const PAGE_SIZE = 8

export type SearchCriteria = {
  type?: string
  district?: string
  propertyType?: string
  sort?: string
}

function parseSpec(rooms: string, label: string): number | undefined {
  const match = rooms.match(new RegExp(`([\\d.]+)\\s+${label}`, "i"))
  return match ? Number(match[1]) : undefined
}

export function SearchResults({ criteria }: { criteria: SearchCriteria }) {
  const filters = useMemo(() => {
    const next: Partial<ListingFeedQuery> = {}
    if (criteria.type) next.type = criteria.type as ListingFeedQuery["type"]
    if (criteria.district) next.district = criteria.district
    if (criteria.propertyType) {
      next.propertyType =
        criteria.propertyType as ListingFeedQuery["propertyType"]
    }
    next.sort = (criteria.sort ?? "newest") as ListingFeedQuery["sort"]
    return next
  }, [criteria])

  const feed = useListingFeed(filters)
  const pages = feed.data?.pages
  const listings = useMemo(
    () => pages?.flatMap((page) => page.items) ?? [],
    [pages],
  )

  const results: SearchResult[] = useMemo(() => (listings.length
    ? listings.map((listing) => ({
        slug: listing.slug,
        title: listing.title,
        city: `${listing.location.locality}, ${listing.location.district}`,
        image: listing.coverImageUrl ?? "/images/featured-1.webp",
        bedrooms: listing.specifications.bedrooms ?? undefined,
        bathrooms: listing.specifications.bathrooms ?? undefined,
        price: listing.price
          ? formatMinorAmount(listing.price.amountMinor, listing.price.currency)
          : undefined,
        priceLabel: listing.listingType === "RENT" ? "Per month" : "Guide price",
      }))
    : DEMO_RESIDENCES.map((residence) => ({
        slug: residence.slug,
        title: residence.title,
        city: residence.city,
        image: residence.image,
        ...(residence.images ? { images: residence.images } : {}),
        bedrooms: parseSpec(residence.rooms, "bedrooms"),
        bathrooms: parseSpec(residence.rooms, "baths"),
        price: "NPR 4,25,00,000",
        originalPrice: "NPR 4,80,00,000",
        priceLabel: "Guide price",
      }))), [listings])

  // Only listings with a geocoded address can carry a pin.
  const mapMarkers: MapMarkerData[] = useMemo(() => (listings.length
    ? listings.flatMap((listing) => {
        const { latitude, longitude } = listing.location
        if (latitude == null || longitude == null) return []
        return [
          {
            slug: listing.slug,
            title: listing.title,
            city: `${listing.location.locality}, ${listing.location.district}`,
            image: listing.coverImageUrl ?? "/images/featured-1.webp",
            price: listing.price
              ? formatMinorAmount(
                  listing.price.amountMinor,
                  listing.price.currency,
                )
              : undefined,
            priceLabel:
              listing.listingType === "RENT" ? "Per month" : "Guide price",
            bedrooms: listing.specifications.bedrooms ?? undefined,
            bathrooms: listing.specifications.bathrooms ?? undefined,
            latitude,
            longitude,
          },
        ]
      })
    : DEMO_RESIDENCES.flatMap((residence) =>
        residence.latitude == null || residence.longitude == null
          ? []
          : [
              {
                slug: residence.slug,
                title: residence.title,
                city: residence.city,
                image: residence.image,
                price: "NPR 4,25,00,000",
                originalPrice: "NPR 4,80,00,000",
                priceLabel: "Guide price",
                bedrooms: parseSpec(residence.rooms, "bedrooms"),
                bathrooms: parseSpec(residence.rooms, "baths"),
                latitude: residence.latitude,
                longitude: residence.longitude,
              },
            ],
      )), [listings])

  // Map viewport drives which results the panel shows, Zillow-style.
  const [bounds, setBounds] = useState<MapBounds | null>(null)
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null)

  const coordsBySlug = useMemo(() => {
    const index = new Map<string, { latitude: number; longitude: number }>()
    for (const marker of mapMarkers) {
      index.set(marker.slug, {
        latitude: marker.latitude,
        longitude: marker.longitude,
      })
    }
    return index
  }, [mapMarkers])

  // A result with no coordinates cannot be placed, so it is never filtered out.
  const inView = useMemo(() => {
    if (!bounds) return results
    return results.filter((result) => {
      const point = coordsBySlug.get(result.slug)
      if (!point) return true
      return (
        point.longitude >= bounds.west &&
        point.longitude <= bounds.east &&
        point.latitude >= bounds.south &&
        point.latitude <= bounds.north
      )
    })
  }, [bounds, coordsBySlug, results])

  // Reference behaviour: reveal in batches as the sentinel comes into view.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const hasMore = visibleCount < inView.length || Boolean(feed.hasNextPage)

  // Re-panning or re-filtering starts the list over rather than keeping a stale
  // depth. Adjusting during render avoids a second paint at the old count.
  const viewSignature = useMemo(
    () => JSON.stringify([bounds, filters]),
    [bounds, filters],
  )
  const [lastSignature, setLastSignature] = useState(viewSignature)
  if (viewSignature !== lastSignature) {
    setLastSignature(viewSignature)
    setVisibleCount(PAGE_SIZE)
  }

  const fetchNextPage = feed.fetchNextPage
  const hasNextPage = feed.hasNextPage
  const isFetchingNextPage = feed.isFetchingNextPage

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setVisibleCount((count) => {
          if (count < inView.length) {
            return Math.min(count + PAGE_SIZE, inView.length)
          }
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
          return count
        })
      },
      { rootMargin: "600px 0px" },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [fetchNextPage, hasMore, hasNextPage, inView.length, isFetchingNextPage])

  const visible = inView.slice(0, visibleCount)
  const heading = criteria.district
    ? `Residences in ${criteria.district}`
    : "Explore all residences"

  return (
    <>
      <PublicHeader />
      <main className="min-h-screen bg-white pt-[72px]">
        <div className="grid min-h-[calc(100vh-72px)] lg:grid-cols-[minmax(620px,47%)_1fr] 2xl:grid-cols-[minmax(680px,45%)_1fr]">
          <section className="min-w-0 bg-white px-5 pt-7 pb-16 sm:px-6 lg:px-7 xl:px-8">
            <div className="mb-5 flex items-end justify-between gap-6">
              <div>
                <p className="text-[13px] leading-5 text-[#777]">
                  Bhumiraj residences
                </p>
                <h1 className="mt-1 text-[30px] leading-[1.05] font-medium tracking-[-.04em] text-[#202020] xl:text-[32px]">
                  {heading}
                </h1>
              </div>
              <span className="shrink-0 pb-0.5 text-[13px] text-[#8a8a8a]">
                {feed.isPending
                  ? "…"
                  : bounds && inView.length !== results.length
                    ? `${inView.length} of ${results.length} homes in view`
                    : `${inView.length} homes`}
              </span>
            </div>

            <div className="mb-7">
              <SearchHeaderControls criteria={criteria} />
            </div>

            {listings.length === 0 && !feed.isPending && (
              <p className="mb-5 text-[13px] text-[#8a8a8a]">
                No published listings match this search yet — sample residences
                are shown.
              </p>
            )}

            {feed.isPending ? (
              <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 xl:gap-x-5">
                {Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="pb-8">
                    <div className="aspect-[4/3.25] animate-pulse rounded-lg bg-[#f1f1ef]" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 xl:gap-x-5">
                {visible.map((result, index) => (
                  <ResultCard
                    key={result.slug}
                    result={result}
                    index={index}
                    highlighted={hoveredSlug === result.slug}
                    onHoverChange={setHoveredSlug}
                  />
                ))}
              </div>
            )}

            <div
              ref={sentinelRef}
              className="flex min-h-24 items-center justify-center py-6"
            >
              {feed.isFetchingNextPage && (
                <div className="flex items-center gap-2 text-[13px] text-[#777]">
                  <span className="size-4 animate-spin rounded-full border-2 border-black/15 border-t-black/60" />
                  Loading more residences…
                </div>
              )}
              {!hasMore && !feed.isPending && (
                <span className="text-[13px] text-[#9a9a9a]">
                  You&apos;ve reached the end
                </span>
              )}
            </div>
          </section>

          <aside className="sticky top-[72px] hidden h-[calc(100vh-72px)] bg-white p-5 pl-3 lg:block xl:p-6 xl:pl-4">
            <MapSurface
              markers={mapMarkers}
              hoveredSlug={hoveredSlug}
              onHoverChange={setHoveredSlug}
              onBoundsChange={setBounds}
            />
          </aside>
        </div>
      </main>
    </>
  )
}
