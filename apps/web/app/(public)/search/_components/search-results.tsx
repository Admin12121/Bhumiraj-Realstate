"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useAnimatedList } from "@/hooks/use-animated-list"
import type { ListingFeedQuery } from "@real-estate/contracts"
import { PublicHeader } from "@/app/_components/public-header"
import {
  NEPAL_PROVINCE_VIEW,
  provinceOfDistrict,
} from "@real-estate/contracts"
import { useListingFeed } from "@/features/listings/queries/use-listing-feed"
import { formatMinorAmount } from "@/shared/utilities/money"
import {
  MapSurface,
  type MapBounds,
  type MapMarkerData,
} from "@/app/_components/property-map"
import { SearchHeaderControls } from "./search-header-controls"
import {
  ResultCard,
  ResultCardSkeleton,
  type SearchResult,
} from "./result-card"

/** Cards revealed per infinite-scroll batch. */
const PAGE_SIZE = 8
/** Hard ceiling on rendered cards. Beyond this the map is the way to narrow. */
const MAX_CARDS = 20

export type SearchCriteria = {
  province?: string | undefined
  type?: string
  district?: string
  propertyType?: string
  sort?: string
}

export function SearchResults({ criteria }: { criteria: SearchCriteria }) {
  const filters = useMemo(() => {
    const next: Partial<ListingFeedQuery> = {}
    if (criteria.type) next.type = criteria.type as ListingFeedQuery["type"]
    if (criteria.province) next.province = criteria.province
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
        image: listing.coverImageUrl ?? "",
        bedrooms: listing.specifications.bedrooms ?? undefined,
        bathrooms: listing.specifications.bathrooms ?? undefined,
        area: listing.specifications.areaSqFt
          ? `${listing.specifications.areaSqFt.toLocaleString()} sq ft`
          : undefined,
        propertyType: listing.propertyType,
        price: listing.price
          ? formatMinorAmount(listing.price.amountMinor, listing.price.currency)
          : undefined,
        priceLabel: listing.listingType === "RENT" ? "Per month" : "Guide price",
        verified: listing.isVerified,
      }))
    : []), [listings])

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
            image: listing.coverImageUrl ?? "",
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
            area: listing.specifications.areaSqFt
              ? `${listing.specifications.areaSqFt.toLocaleString()} sq ft`
              : undefined,
            latitude,
            longitude,
          },
        ]
      })
    : []), [listings])

  // Map viewport drives which results the panel shows, Zillow-style.
  const [bounds, setBounds] = useState<MapBounds | null>(null)
  // Blocked tiles or a failed style would otherwise leave the panel waiting on
  // a viewport that never arrives, so the list falls back to unfiltered.
  const [mapTimedOut, setMapTimedOut] = useState(false)
  // Bounds changes re-render the whole list, so they run as a transition: React
  // reports genuine pending work instead of us faking a delay.
  const [reflowing, startReflow] = useTransition()
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null)

  useEffect(() => {
    if (bounds) return
    const timer = window.setTimeout(() => setMapTimedOut(true), 4_000)
    return () => window.clearTimeout(timer)
  }, [bounds])

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
    if (!bounds) return mapTimedOut ? results : []
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
  }, [bounds, coordsBySlug, mapTimedOut, results])

  // Only the closest results to the middle of the view are rendered. This is
  // what keeps the panel bounded when an area holds hundreds of properties.
  const capped = useMemo(() => {
    if (!bounds || inView.length <= MAX_CARDS) return inView.slice(0, MAX_CARDS)
    const centreLng = (bounds.west + bounds.east) / 2
    const centreLat = (bounds.south + bounds.north) / 2
    return [...inView]
      .sort((a, b) => {
        const pa = coordsBySlug.get(a.slug)
        const pb = coordsBySlug.get(b.slug)
        if (!pa || !pb) return 0
        const da = (pa.longitude - centreLng) ** 2 + (pa.latitude - centreLat) ** 2
        const db = (pb.longitude - centreLng) ** 2 + (pb.latitude - centreLat) ** 2
        return da - db
      })
      .slice(0, MAX_CARDS)
  }, [bounds, coordsBySlug, inView])

  // Choosing a district should take the camera there, not leave the user to
  // find it. Real pins win; with none we fall back to the province anchor.
  const region = useMemo(() => {
    const province = criteria.province ?? ""
    const district = criteria.district ?? ""
    // The boundary layer frames a district exactly; region only covers the
    // province-only case.
    if (district) return null
    if (!province) return null
    const key = `${province}|${district}`

    if (mapMarkers.length > 0) {
      const total = mapMarkers.reduce(
        (sum, marker) => ({
          latitude: sum.latitude + marker.latitude,
          longitude: sum.longitude + marker.longitude,
        }),
        { latitude: 0, longitude: 0 },
      )
      return {
        key,
        latitude: total.latitude / mapMarkers.length,
        longitude: total.longitude / mapMarkers.length,
        zoom: district ? 12 : 9.5,
      }
    }

    const anchorProvince = province || provinceOfDistrict(district) || ""
    const point = NEPAL_PROVINCE_VIEW[anchorProvince]
    if (!point) return null
    return { key, ...point, zoom: district ? 10 : 8.5 }
  }, [criteria.district, criteria.province, mapMarkers])

  const overflowed = inView.length > capped.length

  // Reference behaviour: reveal in batches as the sentinel comes into view.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const hasMore = visibleCount < capped.length || Boolean(feed.hasNextPage)

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
          if (count < capped.length) {
            return Math.min(count + PAGE_SIZE, capped.length)
          }
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
          return count
        })
      },
      { rootMargin: "600px 0px" },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [capped.length, fetchNextPage, hasMore, hasNextPage, isFetchingNextPage])

  const visible = capped.slice(0, visibleCount)
  const { entries, onExited } = useAnimatedList(visible, (item) => item.slug)
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
                {feed.isPending || (!bounds && !mapTimedOut)
                  ? "…"
                  : inView.length !== results.length
                    ? `${inView.length} of ${results.length} homes in view`
                    : `${inView.length} homes`}
              </span>
            </div>

            <div className="mb-7">
              <SearchHeaderControls criteria={criteria} />
            </div>

            {feed.isPending || (!bounds && !mapTimedOut) ? (
              <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 xl:gap-x-5">
                {Array.from({ length: 4 }, (_, index) => (
                  <ResultCardSkeleton key={index} />
                ))}
              </div>
            ) : entries.length === 0 ? (
              /* Panning past every pin is a normal outcome, not loading and not
                 the end of the list. */
              <div className="flex flex-col items-center gap-2 rounded-2xl bg-[#f7f7f6] px-6 py-14 text-center">
                <p className="text-[15px] font-medium text-[#202020]">
                  No properties in this part of the map
                </p>
                <p className="max-w-[320px] text-[13px] leading-5 text-[#8a8a8a]">
                  Zoom out or drag the map to bring listings back into view.
                </p>
              </div>
            ) : (
              <div
                className={`grid grid-cols-1 gap-x-4 transition-opacity duration-200 sm:grid-cols-2 xl:gap-x-5 ${
                  reflowing ? "opacity-60" : "opacity-100"
                }`}
              >
                {entries.map((entry) => (
                  <div
                    key={entry.key}
                    className={entry.exiting ? "card-exit" : "card-enter"}
                    style={{
                      animationDelay: `${Math.min(entry.order, 6) * 35}ms`,
                    }}
                    onAnimationEnd={() => {
                      if (entry.exiting) onExited(entry.key)
                    }}
                  >
                    <ResultCard
                      result={entry.item}

                      highlighted={hoveredSlug === entry.item.slug}
                      onHoverChange={setHoveredSlug}
                    />
                  </div>
                ))}
              </div>
            )}

            {overflowed ? (
              <p className="mt-4 rounded-xl bg-[#f7f7f6] px-4 py-3 text-center text-[13px] text-[#636363]">
                Showing the {capped.length} closest of {inView.length} properties
                here — zoom in to see the rest.
              </p>
            ) : null}

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
              {!hasMore && !feed.isPending && !overflowed && capped.length > 0 && (
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
              onBoundsChange={(next) => startReflow(() => setBounds(next))}
              region={region}
              district={criteria.district ?? null}
            />
          </aside>
        </div>
      </main>
    </>
  )
}
