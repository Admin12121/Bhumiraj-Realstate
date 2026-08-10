"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Bookmark,
  Building2,
  ChevronDown,
  CircleUserRound,
  Home,
  HousePlus,
  LogIn,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  SlidersHorizontal,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useSession } from "@real-estate/auth/client";
import type { ListingCard, ListingFeedQuery } from "@real-estate/contracts";
import { PropertyCard } from "@/features/listings/components/property-card";
import { useListingFeed } from "@/features/listings/queries/use-listing-feed";
import { BrandLogo } from "@/shared/components/brand-logo";

const ListingMap = dynamic(
  () => import("./listing-map").then((module) => module.ListingMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] animate-pulse rounded-2xl bg-emerald-50" />
    ),
  },
);

const navAuthenticated = [
  ["Home", Home, "/"],
  ["Explore", Search, "/properties"],
  ["Saved", Bookmark, "/account/saved"],
  ["Messages", MessageCircle, "/account/messages"],
  ["Alerts", Bell, "/account/alerts"],
  ["Post Property", HousePlus, "/post-property"],
] as const;

const navGuest = [
  ["Home", Home, "/"],
  ["Explore", Search, "/properties"],
] as const;

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

function Sidebar({
  authenticated,
  name,
}: {
  authenticated: boolean;
  name?: string | null;
}) {
  const nav = authenticated ? navAuthenticated : navGuest;

  return (
    <aside className="sticky top-0 hidden h-screen w-[252px] shrink-0 border-r bg-white px-5 py-5 xl:flex xl:flex-col">
      <BrandLogo />
      <nav className="mt-9 space-y-2" aria-label="Primary navigation">
        {nav.map(([label, Icon, href], index) => (
          <Link
            key={label}
            href={href}
            className={`flex items-center gap-4 rounded-xl px-3 py-3 text-sm font-medium ${
              index === 0
                ? "bg-emerald-50 text-emerald-900"
                : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto space-y-4">
        {authenticated ? (
          <>
            <div className="rounded-2xl border border-emerald-200 p-4">
              <div className="mb-3 flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                <HousePlus className="size-5" />
              </div>
              <p className="font-semibold">List your property</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Reach verified buyers, renters, and agents.
              </p>
              <Link
                href="/post-property"
                className="brand-button mt-4 block rounded-lg px-4 py-2.5 text-center text-sm font-medium"
              >
                Post Property
              </Link>
            </div>
            <Link
              href="/account/profile"
              className="flex items-center gap-3 border-t pt-4"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-emerald-50">
                <CircleUserRound className="size-6 text-emerald-800" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {name || "My account"}
                </span>
                <span className="text-[11px] text-slate-500">View profile</span>
              </span>
              <ChevronDown className="size-4" />
            </Link>
          </>
        ) : (
          <Link
            href="/sign-in"
            className="brand-button flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-medium"
          >
            <LogIn className="size-4" />
            Login
          </Link>
        )}
      </div>
    </aside>
  );
}

function Header({
  authenticated,
  query,
  onQueryChange,
}: {
  authenticated: boolean;
  query: string;
  onQueryChange: (value: string) => void;
}) {
  return (
    <header className="flex items-center gap-4">
      <label className="surface flex h-13 min-w-0 flex-1 items-center rounded-2xl px-4">
        <Search className="size-5 text-slate-700" />
        <span className="sr-only">Search properties, locations, or agents</span>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
          placeholder="Search properties, locations, agents..."
        />
        <span className="hidden h-7 w-px bg-slate-200 sm:block" />
        <span className="hidden items-center gap-2 px-3 text-xs font-medium sm:flex">
          <MapPin className="size-4" />
          Kathmandu
        </span>
      </label>

      {authenticated && (
        <>
          <Link
            aria-label="Notifications"
            href="/account/alerts"
            className="hidden rounded-full p-2.5 hover:bg-slate-100 sm:block"
          >
            <Bell className="size-5" />
          </Link>
          <Link
            aria-label="Messages"
            href="/account/messages"
            className="hidden rounded-full p-2.5 hover:bg-slate-100 sm:block"
          >
            <MessageCircle className="size-5" />
          </Link>
        </>
      )}

      <Link
        href="/post-property"
        className="brand-button flex h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-medium"
      >
        <Plus className="size-4" />
        <span className="hidden sm:inline">Post Property</span>
      </Link>
    </header>
  );
}

function Hero({
  authenticated,
  name,
}: {
  authenticated: boolean;
  name?: string | null;
}) {
  return (
    <section className="surface relative mt-5 min-h-[188px] overflow-hidden rounded-[22px] px-6 py-6 sm:px-7">
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
        <button
          type="button"
          aria-pressed={mode === value}
          onClick={() => onModeChange(value)}
          key={value}
          className={`rounded-xl border px-4 py-3 transition ${
            mode === value
              ? "border-emerald-100 bg-emerald-50 text-emerald-900"
              : "bg-white hover:border-emerald-300"
          }`}
        >
          {label}
        </button>
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
    <aside className="hidden w-[340px] shrink-0 space-y-4 2xl:block">
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

export function HomeShell() {
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
  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = observerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (
          entry?.isIntersecting &&
          feed.hasNextPage &&
          !feed.isFetchingNextPage
        ) {
          void feed.fetchNextPage();
        }
      },
      { rootMargin: "500px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [feed.fetchNextPage, feed.hasNextPage, feed.isFetchingNextPage]);

  const listings = useMemo(
    () => feed.data?.pages.flatMap((page) => page.items) ?? [],
    [feed.data],
  );
  const mobileNavItems: Array<[LucideIcon, string, string]> = [
    [Home, "/", "Home"],
    [Search, "/properties", "Explore"],
    [Plus, "/post-property", "Post property"],
    [Bookmark, authenticated ? "/account/saved" : "/sign-in", "Saved"],
    [
      CircleUserRound,
      authenticated ? "/account/profile" : "/sign-in",
      "Account",
    ],
  ];

  return (
    <div className="mx-auto flex min-h-screen max-w-[1920px] bg-[#fbfcfb]">
      <Sidebar
        authenticated={authenticated}
        name={session.data?.user.name}
      />
      <div className="min-w-0 flex-1 px-4 py-4 sm:px-6 lg:px-8">
        <Header
          authenticated={authenticated}
          query={search}
          onQueryChange={setSearch}
        />
        <div className="mt-1 flex gap-5">
          <main className="min-w-0 flex-1">
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
                    className="surface h-[420px] animate-pulse rounded-[22px] bg-slate-100"
                  />
                ))}
              {feed.isError && (
                <div className="surface rounded-2xl p-8 text-center">
                  <p className="font-semibold">Properties could not be loaded.</p>
                  <button
                    type="button"
                    onClick={() => void feed.refetch()}
                    className="mt-3 rounded-lg border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800"
                  >
                    Try again
                  </button>
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
          </main>
          <RightRail listings={listings} />
        </div>
      </div>

      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-3 bottom-3 z-50 flex justify-around rounded-2xl border bg-white/95 p-2 shadow-xl backdrop-blur xl:hidden"
      >
        {mobileNavItems.map(([Icon, href, label], index) => (
          <Link
            href={String(href)}
            aria-label={String(label)}
            key={String(label)}
            className={`rounded-xl p-3 ${
              index === 0 ? "bg-emerald-50 text-emerald-800" : "text-slate-500"
            }`}
          >
            <Icon className="size-5" />
          </Link>
        ))}
      </nav>
    </div>
  );
}
