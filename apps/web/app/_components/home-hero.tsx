"use client"

import Link from "next/link"
import { type ReactNode } from "react"
import type { ListingFeedQuery } from "@real-estate/contracts"
import { PropertySearch } from "@/app/_components/property-search"
import { useListingFeed } from "@/features/listings/queries/use-listing-feed"
import { DEMO_RESIDENCES } from "./demo-residences"
import { ResidenceCard, type Residence } from "./residence-card"
import { BhumirajDifference, LovedByOwners } from "./home-sections"
import { SiteFooter } from "./site-footer"

const DISTRICTS = ["Kathmandu", "Lalitpur", "Bhaktapur", "Pokhara", "Chitwan"]

function marketsFor(type: string) {
  return [
    { label: "All markets", href: `/search?type=${type}` },
    ...DISTRICTS.map((district) => ({
      label: district,
      href: `/search?type=${type}&district=${encodeURIComponent(district)}`,
    })),
  ]
}

/** Shapes an API listing into the card model the reference components expect. */
function toResidence(listing: {
  slug: string
  title: string
  isVerified: boolean
  coverImageUrl: string | null
  location: { district: string }
  specifications: {
    bedrooms?: number | null
    bathrooms?: number | null
    areaSqFt?: number | null
  }
}): Residence {
  return {
    slug: listing.slug,
    image: listing.coverImageUrl ?? "/images/featured-1.webp",
    city: listing.location.district,
    title: listing.title,
    rooms: [
      listing.specifications.bedrooms
        ? `${listing.specifications.bedrooms} bedrooms`
        : null,
      listing.specifications.bathrooms
        ? `${listing.specifications.bathrooms} baths`
        : null,
      listing.specifications.areaSqFt
        ? `${listing.specifications.areaSqFt.toLocaleString()} sq ft`
        : null,
    ]
      .filter(Boolean)
      .join(" · "),
    ...(listing.isVerified ? { available: "Verified" } : {}),
  }
}

/** A titled strip of listings, matching the reference's featured section. */
function ResidenceRow({
  title,
  filters,
  markets,
  exploreHref,
}: {
  title: ReactNode
  filters: Partial<ListingFeedQuery>
  markets: { label: string; href: string }[]
  exploreHref: string
}) {
  const feed = useListingFeed(filters)
  const items = (feed.data?.pages.flatMap((page) => page.items) ?? []).slice(0, 4)

  return (
    <section className="mx-auto flex w-full max-w-[1920px] flex-col items-center gap-9 bg-white px-6 pt-16 pb-24 lg:px-9">
      <header className="flex w-full flex-col items-start justify-between gap-5 lg:flex-row lg:items-center lg:gap-6">
        <h2 className="shrink-0 text-[22px] leading-normal font-medium tracking-[-.75px] whitespace-nowrap text-[#221811] md:text-[24px] md:tracking-[-1px]">
          {title}
        </h2>
        <nav
          aria-label="Browse markets"
          className="flex w-full gap-3 overflow-x-auto pb-1 [scrollbar-width:none] lg:w-auto lg:gap-4 [&::-webkit-scrollbar]:hidden"
        >
          {markets.map((market) => (
            <Link
              key={market.label}
              href={market.href}
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-[360px] border border-[rgba(233,232,230,.8)] bg-white px-5 text-[15px] leading-none font-normal whitespace-nowrap text-[#221811] no-underline transition-colors hover:border-[#d1cbc7] hover:bg-[#f8f8f8]"
            >
              {market.label}
            </Link>
          ))}
        </nav>
      </header>

      {feed.isPending ? (
        <div className="grid w-full grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-6">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="h-[300px] animate-pulse rounded-[8px] bg-[#f2f2f0]"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="grid w-full grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-6">
          {DEMO_RESIDENCES.map((residence) => (
            <ResidenceCard key={residence.slug} residence={residence} />
          ))}
        </div>
      ) : (
        <div className="grid w-full grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-6">
          {items.map((listing) => (
            <ResidenceCard key={listing.id} residence={toResidence(listing)} />
          ))}
        </div>
      )}

      <Link
        href={exploreHref}
        className="inline-flex h-11 items-center justify-center rounded-[360px] border border-[rgba(233,232,230,.8)] bg-white px-5 text-[15px] leading-none font-normal text-[#221811] transition-colors hover:border-[#d1cbc7] hover:bg-[#f8f8f8]"
      >
        Explore all residences
      </Link>
    </section>
  )
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
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative mx-auto mt-7 flex w-full max-w-[1832px] flex-col items-center gap-3 px-6 pb-28 text-center text-white lg:px-8 lg:pb-0 2xl:px-12">
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

      <ResidenceRow
        title={
          <>
            Explore our <em className="font-medium">featured</em> residences
          </>
        }
        filters={{ type: "SALE", sort: "popular" }}
        markets={marketsFor("SALE")}
        exploreHref="/search?type=SALE"
      />

      <LovedByOwners />
      <BhumirajDifference />
    </main>
    <SiteFooter />
    </>
  )
}
