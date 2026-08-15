"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  ChevronDown,
  MapPin,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { useSession } from "@real-estate/auth/client";
import type { ListingCard, ListingFeedQuery } from "@real-estate/contracts";
import { PropertyCard } from "@/app/_components/property-card";
import { useListingFeed } from "@/features/listings/queries/use-listing-feed";
import { Button } from "@/components/ui/button";
import { MarketplacePageShell } from "./marketplace-page-shell";
import { SiteHeader } from "./site-header";
import { ScrollArea } from "@/components/ui/scroll-area";

const ListingMap = dynamic(
  () => import("./listing-map").then((module) => module.ListingMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] animate-pulse rounded-2xl bg-emerald-50" />
    ),
  },
);

const categories = [
  ["Top Picks", "/assets/category-land.svg", "/properties?sort=popular"],
  ["Houses", "/assets/category-house.svg", "/properties?propertyType=HOUSE"],
  [
    "Apartments",
    "/assets/category-apartment.svg",
    "/properties?propertyType=APARTMENT",
  ],
  [
    "Commercial",
    "/assets/category-commercial.svg",
    "/properties?propertyType=COMMERCIAL",
  ],
  ["Land", "/assets/category-land.svg", "/properties?propertyType=LAND"],
  ["Rentals", "/assets/category-rental.svg", "/properties?type=RENT"],
  ["Agents", "/assets/category-house.svg", "/agents"],
] as const;

type FeedMode = "FOR_YOU" | "SALE" | "RENT" | "AUCTION" | "COMMERCIAL";

function Hero({
  authenticated,
  name,
}: {
  authenticated: boolean;
  name?: string | null;
}) {
  return (
    <section className="surface relative min-h-[188px] overflow-hidden rounded-[22px] px-6 py-6 sm:px-7">
      <div className="relative z-10 max-w-[370px]">
        {authenticated && (
          <p className="mb-3 text-sm font-semibold text-slate-800">
            👋 Namaste, {name?.split(" ")[0] || "there"}!
          </p>
        )}
        <h1 className="text-[30px] font-bold leading-[1.08] tracking-[-.035em]">
          Find your perfect place
          <br />
          in Nepal.
        </h1>
        <p className="mt-3 max-w-[330px] text-xs leading-5 text-slate-600">
          Discover verified properties, connect with trusted agents, and make
          informed real-estate decisions.
        </p>
        {!authenticated && (
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/properties"
              className="brand-button rounded-lg px-5 py-2.5 text-sm font-semibold"
            >
              Explore Properties
            </Link>
            <Link
              href="/sign-in"
              className="rounded-lg border border-emerald-700 bg-white px-5 py-2.5 text-sm font-semibold text-emerald-800"
            >
              Sign In / Sign Up
            </Link>
          </div>
        )}
      </div>
      <Image
        src="/assets/hero-nepal.svg"
        alt="Illustrated Nepal landscape"
        width={660}
        height={220}
        className="absolute -right-12 -bottom-3 hidden h-[200px] w-[62%] object-contain object-bottom md:block"
      />
    </section>
  );
}

function CategoryStrip() {
  return (
    <div className="surface subtle-scrollbar mt-4 flex gap-5 overflow-x-auto rounded-[22px] px-5 py-4">
      {categories.map(([label, image, href], index) => (
        <Link
          href={href}
          key={label}
          className="group flex min-w-[75px] flex-col items-center gap-2"
        >
          <span
            className={`relative size-[66px] overflow-hidden rounded-full border-2 bg-white p-1 ${
              index === 0
                ? "border-emerald-800"
                : "border-slate-200 group-hover:border-emerald-500"
            }`}
          >
            <Image
              src={image}
              fill
              alt=""
              className="rounded-full object-cover p-1.5"
            />
          </span>
          <span className="text-[11px] font-semibold">{label}</span>
        </Link>
      ))}
    </div>
  );
}

function Filters({
  mode,
  onModeChange,
}: {
  mode: FeedMode;
  onModeChange: (mode: FeedMode) => void;
}) {
  const options: Array<[FeedMode, string]> = [
    ["FOR_YOU", "For You"],
    ["SALE", "Buy"],
    ["RENT", "Rent"],
    ["AUCTION", "Auction"],
    ["COMMERCIAL", "Commercial"],
  ];

  return (
    <div className="mt-4 flex gap-2 overflow-x-auto pb-1 text-xs font-medium">
      {options.map(([value, label]) => (
        <Button
          type="button"
          variant="outline"
          aria-pressed={mode === value}
          onClick={() => onModeChange(value)}
          key={value}
          className={`h-auto rounded-xl px-4 py-3 transition ${
            mode === value
              ? "border-emerald-100 bg-emerald-50 text-emerald-900"
              : "bg-white hover:border-emerald-300"
          }`}
        >
          {label}
        </Button>
      ))}
      <Link
        href="/properties?district=Kathmandu"
        className="ml-auto flex min-w-fit items-center gap-2 rounded-xl border bg-white px-4 py-3"
      >
        <MapPin className="size-4" />
        Kathmandu
        <ChevronDown className="size-3" />
      </Link>
      <Link
        href="/properties"
        className="flex min-w-fit items-center gap-2 rounded-xl border bg-white px-4 py-3"
      >
        Budget
        <ChevronDown className="size-3" />
      </Link>
      <Link
        href="/properties"
        className="flex min-w-fit items-center gap-2 rounded-xl border bg-white px-4 py-3"
      >
        More Filters
        <SlidersHorizontal className="size-4" />
      </Link>
    </div>
  );
}

function RightRail({ listings }: { listings: ListingCard[] }) {
  const areas = useMemo(() => {
    const counts = new Map<string, { district: string; count: number }>();
    for (const listing of listings) {
      const key = listing.location.locality;
      const current = counts.get(key);
      counts.set(key, {
        district: listing.location.district,
        count: (current?.count ?? 0) + 1,
      });
    }
    return [...counts.entries()]
      .sort((left, right) => right[1].count - left[1].count)
      .slice(0, 4);
  }, [listings]);

  const agents = useMemo(() => {
    const unique = new Map<string, ListingCard["agent"]>();
    for (const listing of listings) unique.set(listing.agent.id, listing.agent);
    return [...unique.values()].slice(0, 3);
  }, [listings]);

  return (
    <aside className="hidden h-[calc(100vh-var(--header-height))] w-[340px] shrink-0 space-y-4 min-[1400px]:block">
      <section className="surface rounded-[22px] p-3">
        <div className="flex items-center justify-between px-1 pb-3">
          <h2 className="font-semibold">Live Map</h2>
          <Link
            href="/properties?view=map"
            className="text-xs font-semibold text-emerald-800"
          >
            View full map
          </Link>
        </div>
        <ListingMap listings={listings} />
      </section>

      <section className="surface rounded-[22px] p-4">
        <div className="mb-3 flex justify-between">
          <h2 className="font-semibold">Popular Areas</h2>
          <Link
            href="/properties"
            className="text-xs font-semibold text-emerald-800"
          >
            View all ›
          </Link>
        </div>
        {areas.length ? (
          areas.map(([locality, area]) => (
            <Link
              href={`/properties?q=${encodeURIComponent(locality)}`}
              key={locality}
              className="flex items-center gap-3 border-t py-3 first:border-0"
            >
              <div className="size-10 overflow-hidden rounded-lg bg-emerald-50">
                <Image
                  src="/assets/category-house.svg"
                  width={40}
                  height={40}
                  alt=""
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{locality}</p>
                <p className="text-[11px] text-slate-500">{area.district}</p>
              </div>
              <span className="text-xs font-semibold text-emerald-700">
                {area.count} {area.count === 1 ? "listing" : "listings"}
              </span>
            </Link>
          ))
        ) : (
          <p className="py-5 text-sm text-slate-500">
            Popular areas appear as listings are published.
          </p>
        )}
      </section>

      <section className="surface rounded-[22px] p-4">
        <div className="mb-3 flex justify-between">
          <h2 className="font-semibold">Listing Agents</h2>
          <Link
            href="/agents"
            className="text-xs font-semibold text-emerald-800"
          >
            View all ›
          </Link>
        </div>
        {agents.length ? (
          agents.map((agent) => (
            <Link
              href={`/users/${agent.id}`}
              key={agent.id}
              className="flex items-center gap-3 border-t py-3 first:border-0"
            >
              {agent.image ? (
                <Image
                  src={agent.image}
                  alt=""
                  width={40}
                  height={40}
                  className="size-10 rounded-full object-cover"
                />
              ) : (
                <span className="flex size-10 items-center justify-center rounded-full bg-emerald-50">
                  <UserRound className="size-5 text-emerald-700" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{agent.name}</p>
                <p className="text-[11px] text-slate-500">
                  {agent.verified ? "Verified agent" : "Property agent"}
                </p>
              </div>
              <span className="rounded-lg border border-emerald-700 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-800">
                Profile
              </span>
            </Link>
          ))
        ) : (
          <p className="py-5 text-sm text-slate-500">
            Agent profiles appear with published listings.
          </p>
        )}
      </section>
    </aside>
  );
}

export function Home() {
  const session = useSession();
  const authenticated = Boolean(session.data?.user);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [mode, setMode] = useState<FeedMode>("FOR_YOU");

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [search]);

  const filters = useMemo<Partial<ListingFeedQuery>>(
    () => ({
      ...(debouncedSearch ? { q: debouncedSearch } : {}),
      ...(mode === "SALE" || mode === "RENT" || mode === "AUCTION"
        ? { type: mode }
        : {}),
      ...(mode === "COMMERCIAL"
        ? { propertyType: "COMMERCIAL" as const }
        : {}),
      sort: mode === "FOR_YOU" ? ("popular" as const) : ("newest" as const),
    }),
    [debouncedSearch, mode],
  );

  const feed = useListingFeed(filters);
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = feed;
  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = observerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (
          entry?.isIntersecting &&
          hasNextPage &&
          !isFetchingNextPage
        ) {
          void fetchNextPage();
        }
      },
      { rootMargin: "500px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const listings = useMemo(
    () => feed.data?.pages.flatMap((page) => page.items) ?? [],
    [feed.data],
  );
  return (
    <MarketplacePageShell scrollable={false}>
      <div
        data-lenis-prevent
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain"
      >
        <SiteHeader
          authenticated={authenticated}
          query={search}
          onQueryChange={setSearch}
        />
        <main id="main-content" className="flex min-h-0 min-w-0 flex-1 gap-5">
          <ScrollArea
            scrollFade
            className="h-[calc(100vh-var(--header-height))] min-w-0 flex-1 p-4 pb-24 min-[800px]:pb-4"
          >
              <Hero
                authenticated={authenticated}
                name={session.data?.user.name}
              />
              <CategoryStrip />
              <Filters mode={mode} onModeChange={setMode} />
              <div className="mt-4 space-y-5" aria-live="polite">
                {feed.isPending &&
                  Array.from({ length: 2 }, (_, index) => (
                    <div
                      key={index}
                      className="surface h-[420px] animate-pulse rounded-[22px]"
                    />
                  ))}
                {feed.isError && (
                  <div className="surface rounded-2xl p-8 text-center">
                    <p className="font-semibold">
                      Properties could not be loaded.
                    </p>
                    <Button
                      type="button"
                      onClick={() => void feed.refetch()}
                      variant="outline"
                      className="mt-3 border-emerald-700 text-emerald-800"
                    >
                      Try again
                    </Button>
                  </div>
                )}
                {!feed.isPending && !feed.isError && listings.length === 0 && (
                  <div className="surface rounded-2xl p-10 text-center">
                    <Building2 className="mx-auto size-8 text-emerald-700" />
                    <p className="mt-3 font-semibold">No matching properties</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Change the search or filter to discover more listings.
                    </p>
                  </div>
                )}
                {listings.map((listing) => (
                  <PropertyCard key={listing.id} listing={listing} />
                ))}
                {feed.isFetchingNextPage && (
                  <div className="surface rounded-2xl p-8 text-center text-sm text-slate-500">
                    Loading more properties…
                  </div>
                )}
                <div ref={observerRef} className="h-1" />
              </div>
          </ScrollArea>
          <RightRail listings={listings} />
        </main>
      </div>
    </MarketplacePageShell>
  );
}
