"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import type { ListingFeedQuery } from "@real-estate/contracts"
import {
  FeedFilters,
  initialFeedFilters,
  type FeedFilterState,
} from "./feed-filters"
import type { MapMarkerData } from "./property-map"
import { HeroGrid } from "./hero-grid"
import { PropertySearch } from "@/app/_components/property-search"
import { useListingFeed } from "@/features/listings/queries/use-listing-feed"
import { formatMinorAmount } from "@/shared/utilities/money"
import {
  PropertyPost,
  PropertyPostSkeleton,
  type PropertyPostData,
} from "./property-post"
import {
  NEPAL_PROVINCE_VIEW,
  provinceOfDistrict,
} from "@real-estate/contracts"
import { RailAgents, RailMap } from "./home-rail"
import { BhumirajDifference, LovedByOwners } from "./home-sections"
import { SiteFooter } from "./site-footer"

/** Turns an API listing into the social-post model. */
function toPost(listing: {
  id: string
  slug: string
  title: string
  description: string
  coverImageUrl: string | null
  imageUrls: string[]
  propertyType: string
  listingType: "SALE" | "RENT" | "AUCTION"
  isVerified: boolean
  publishedAt: string | null
  createdAt: string
  agent: {
    id: string
    username: string | null
    name: string
    image: string | null
    verified: boolean
  } | null
  location: {
    locality: string
    district: string
    latitude: number | null
    longitude: number | null
  }
  price: { amountMinor: string; currency: string } | null
  specifications: { areaSqFt: number | null }
  auction: { id: string } | null
  isSaved: boolean
}): PropertyPostData {
  return {
    slug: listing.slug,
    title: listing.title,
    description: listing.description,
    images:
      listing.imageUrls.length > 0
        ? listing.imageUrls
        : listing.coverImageUrl
          ? [listing.coverImageUrl]
          : [],
    agent: {
      ...(listing.agent
        ? {
            id: listing.agent.username ?? listing.agent.id,
            userId: listing.agent.id,
          }
        : {}),
      name: listing.agent?.name ?? "Bhumiraj Estates",
      image: listing.agent?.image ?? null,
      verified: listing.agent?.verified ?? false,
    },
    publishedAt: listing.publishedAt ?? listing.createdAt,
    reference: listing.id.slice(0, 8).toUpperCase(),
    listingType: listing.listingType,
    // Without this the card looks like a sample residence and refuses to save.
    listingId: listing.id,
    saved: listing.isSaved,
    ...(listing.auction ? { auctionId: listing.auction.id } : {}),
    price: listing.price
      ? formatMinorAmount(listing.price.amountMinor, listing.price.currency)
      : undefined,
    location: `${listing.location.locality} | ${listing.location.district}`,
    propertyType: listing.propertyType,
    area: listing.specifications.areaSqFt
      ? `${listing.specifications.areaSqFt.toLocaleString()} sq ft`
      : undefined,
    category: listing.listingType === "RENT" ? "For rent" : "For sale",
    ...(listing.location.latitude != null
      ? { latitude: listing.location.latitude }
      : {}),
    ...(listing.location.longitude != null
      ? { longitude: listing.location.longitude }
      : {}),
    ...(listing.isVerified ? { badge: "Verified listing" } : {}),
  }
}

/** Sample posts shown until real listings are published. */
/** The social feed: filters, posts, and a map/agents rail that tracks scroll. */
function PostFeed({
  filters,
  exploreHref,
}: {
  filters: Partial<ListingFeedQuery>
  exploreHref: string
}) {
  const [sidebar, setSidebar] = useState<FeedFilterState>(initialFeedFilters)
  const [focusSlug, setFocusSlug] = useState<string | null>(null)
  const postRefs = useRef(new Map<string, HTMLElement>())

  // Sidebar selections narrow the same query the feed already runs.
  const query = useMemo<Partial<ListingFeedQuery>>(() => {
    const next: Partial<ListingFeedQuery> = { ...filters }
    if (sidebar.propertyType.length === 1) {
      next.propertyType = sidebar
        .propertyType[0] as ListingFeedQuery["propertyType"]
    }
    if (sidebar.province) next.province = sidebar.province
    if (sidebar.district) next.district = sidebar.district
    if (sidebar.minPrice > 100_000) {
      next.minPriceMinor = BigInt(sidebar.minPrice * 100)
    }
    if (sidebar.maxPrice < 150_000_000) {
      next.maxPriceMinor = BigInt(sidebar.maxPrice * 100)
    }
    return next
  }, [filters, sidebar])

  const feed = useListingFeed(query)
  const pages = feed.data?.pages
  const posts = useMemo(() => {
    const listings = pages?.flatMap((page) => page.items) ?? []
    return listings.map(toPost)
  }, [pages])

  const markers: MapMarkerData[] = useMemo(
    () =>
      posts.flatMap((post) =>
        post.latitude == null || post.longitude == null
          ? []
          : [
              {
                slug: post.slug,
                title: post.title,
                city: post.location,
                image: post.images[0] ?? "",
                price: post.price,
                latitude: post.latitude,
                longitude: post.longitude,
              },
            ],
      ),
    [posts],
  )

  const region = useMemo(
    () => regionView(sidebar.province, sidebar.district, markers),
    [markers, sidebar.district, sidebar.province],
  )

  // Whichever post sits nearest the top third of the viewport drives the map.
  useEffect(() => {
    const nodes = [...postRefs.current.values()]
    if (nodes.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (!visible) return
        const slug = (visible.target as HTMLElement).dataset.slug
        if (slug) setFocusSlug(slug)
      },
      { rootMargin: "-25% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] },
    )

    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [posts])

  return (
    <section className="mx-auto flex w-full max-w-site flex-col gap-9 bg-white px-6 pt-16 pb-24 lg:px-8 2xl:px-12">
      <header className="flex w-full items-center">
        <h2 className="shrink-0 text-[22px] leading-normal font-medium tracking-[-.75px] whitespace-nowrap text-[#221811] md:text-[24px] md:tracking-[-1px]">
          Explore our <em className="font-medium">featured</em> residences
        </h2>
      </header>

      <div className="grid w-full items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_340px] xl:gap-8 2xl:grid-cols-[300px_minmax(0,1fr)_380px]">
        <aside className="sticky top-[88px] hidden lg:block">
          <FeedFilters state={sidebar} onChange={setSidebar} />
        </aside>

        {/* A filter change keeps the current posts on screen and dims them,
            rather than tearing the list down to skeletons and snapping back. */}
        <div
          className={`flex min-w-0 flex-col gap-6 transition-opacity duration-200 ${
            feed.isFetching && !feed.isFetchingNextPage && !feed.isPending
              ? "opacity-60"
              : "opacity-100"
          }`}
        >
          {feed.isPending
            ? Array.from({ length: 2 }, (_, index) => (
                <PropertyPostSkeleton key={index} />
              ))
            : posts.length === 0
              ? (
                  <div className="flex flex-col items-center gap-2 rounded-2xl bg-[#f7f7f6] px-6 py-14 text-center">
                    <p className="text-[15px] font-medium text-[#202020]">
                      No properties match these filters
                    </p>
                    <p className="max-w-[320px] text-[13px] leading-5 text-[#8a8a8a]">
                      Try a wider price range, or clear the location filter.
                    </p>
                  </div>
                )
              : posts.map((post) => (
                  <div
                    key={post.slug}
                    data-slug={post.slug}
                    ref={(node) => {
                      if (node) postRefs.current.set(post.slug, node)
                      else postRefs.current.delete(post.slug)
                    }}
                  >
                    <PropertyPost post={post} />
                  </div>
                ))}

          <div className="flex justify-center pt-2">
            <Link
              href={exploreHref}
              className="inline-flex h-11 items-center justify-center rounded-[360px] border border-[rgba(233,232,230,.8)] bg-white px-5 text-[15px] leading-none font-normal text-[#221811] transition-colors hover:border-[#d1cbc7] hover:bg-[#f8f8f8]"
            >
              Explore all residences
            </Link>
          </div>
        </div>

        <aside className="sticky top-[88px] hidden flex-col gap-6 xl:flex">
          <RailMap
            markers={markers}
            focusSlug={focusSlug}
            region={region}
            district={sidebar.district || null}
          />
          <RailAgents />
        </aside>
      </div>
    </section>
  )
}

/**
 * Where the map should sit for the current location filter. Real listings win:
 * the camera frames their average position. With none, it falls back to the
 * province anchor so choosing a region still takes you there.
 */
function regionView(
  province: string,
  district: string,
  markers: { latitude: number; longitude: number }[],
): { key: string; latitude: number; longitude: number; zoom: number } | null {
  // A chosen district is framed from its real boundary, which is exact; a
  // second camera move from here would only fight it.
  if (district) return null
  if (!province) return null
  const key = `${province}|${district}`

  if (markers.length > 0) {
    const total = markers.reduce(
      (sum, marker) => ({
        latitude: sum.latitude + marker.latitude,
        longitude: sum.longitude + marker.longitude,
      }),
      { latitude: 0, longitude: 0 },
    )
    return {
      key,
      latitude: total.latitude / markers.length,
      longitude: total.longitude / markers.length,
      zoom: district ? 12 : 9.5,
    }
  }

  const anchorProvince = province || provinceOfDistrict(district) || ""
  const anchor = NEPAL_PROVINCE_VIEW[anchorProvince]
  if (!anchor) return null
  return { key, ...anchor, zoom: district ? 10 : 8.5 }
}

export function HomeHero() {
  return (
    <>
    <main className="bg-white">
      {/* Taller below desktop: the search frame stacks there and overhangs the
          hero by half its height, so the copy needs the extra room. */}
      <section className="relative flex h-[28rem] flex-col justify-center overflow-visible bg-black lg:h-95">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hero.webp"
          alt="Modern residence in nature"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="pointer-events-none absolute inset-0 bg-black/50" />
        {/* Above the scrim: underneath it, every glyph was dimmed by half and
            the effect washed out to nothing. */}
        <HeroGrid />
        <div className="relative mx-auto mt-7 flex w-full max-w-site flex-col items-center gap-3 px-6 pb-28 text-center text-white lg:px-8 lg:pb-0 2xl:px-12">
          <h1 className="max-w-[900px] text-[clamp(38px,5.2vw,68px)] leading-[.96] font-medium tracking-[-.05em]">
            Find your place in Nepal
          </h1>
          <p className="max-w-[760px] text-balance text-[16px] leading-6 font-normal text-white/90 md:text-[18px] md:leading-7">
            Verified listings, trusted agents, and transparent auctions. No
            hidden fees.
          </p>
        </div>
        <div className="absolute inset-x-0 bottom-0 z-10 translate-y-1/2 px-4 lg:px-8">
          <PropertySearch />
        </div>
      </section>

      {/* Clears the search frame's overhang: ~114px stacked, ~30px in a row. */}
      <div className="h-32 lg:h-9" />

      <PostFeed
        // "Featured residences" means every published property, not only the
        // ones for sale: a seller who posts a rental was told nothing matched.
        filters={{ sort: "popular" }}
        exploreHref="/search"
      />

      <LovedByOwners />
      <BhumirajDifference />
    </main>
    <SiteFooter />
    </>
  )
}
