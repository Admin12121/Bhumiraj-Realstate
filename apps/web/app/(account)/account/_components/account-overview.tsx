"use client";

import Link from "next/link";
import {
  Bell,
  Bookmark,
  CalendarDays,
  ChevronRight,
  Gavel,
  Handshake,
  HousePlus,
  KeyRound,
  MessageCircle,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useSession } from "@real-estate/auth/client";
import { useAgentSummary } from "@/features/listings/queries/use-agent-workspace";
import { Skeleton } from "@/components/ui/skeleton";

type Tile = {
  href: string;
  label: string;
  hint: string;
  icon: typeof UserRound;
  badge?: number | undefined;
};

function TileLink({ tile }: { tile: Tile }) {
  const Icon = tile.icon;
  return (
    <Link
      href={tile.href}
      className="surface group flex items-center gap-4 rounded-2xl p-4 transition-colors hover:bg-slate-50"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-800">
        <Icon className="size-5" strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 font-medium text-slate-900">
          {tile.label}
          {tile.badge ? (
            <span className="grid size-5 place-items-center rounded-full bg-emerald-700 text-[11px] font-semibold text-white">
              {tile.badge}
            </span>
          ) : null}
        </span>
        <span className="block truncate text-sm text-slate-500">
          {tile.hint}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-slate-300 transition-colors group-hover:text-slate-500" />
    </Link>
  );
}

/** Landing page for /account: where everything the signed-in user owns lives. */
export function AccountOverview() {
  const session = useSession();
  const agent = useAgentSummary();

  const user = session.data?.user;
  const isAgent = agent.data?.isAgent === true;
  const isStaff = user?.role === "OWNER" || user?.role === "STAFF";

  const tiles: Tile[] = [
    {
      href: "/account/settings?tab=profile",
      label: "Profile",
      hint: "Your name, photo and public details",
      icon: UserRound,
    },
    {
      href: "/account/saved",
      label: "Saved properties",
      hint: "Properties you bookmarked",
      icon: Bookmark,
    },
    {
      href: "/account/messages",
      label: "Messages",
      hint: "Conversations with agents",
      icon: MessageCircle,
    },
    {
      href: "/account/alerts",
      label: "Alerts",
      hint: "Saved searches and notifications",
      icon: Bell,
    },
    {
      href: "/account/bids",
      label: "My bids",
      hint: "Auctions you are taking part in",
      icon: Gavel,
    },
    {
      href: "/account/settings?tab=security",
      label: "Security",
      hint: "Password and two-factor authentication",
      icon: ShieldCheck,
    },
    {
      href: "/account/settings?tab=sessions",
      label: "Sessions",
      hint: "Devices signed in to your account",
      icon: KeyRound,
    },
  ];

  const agentTiles: Tile[] = [
    {
      href: "/account/offers",
      label: "Property offers",
      hint: "Properties waiting on your response",
      icon: Handshake,
      ...(agent.data?.isAgent && agent.data.pendingOffers > 0
        ? { badge: agent.data.pendingOffers }
        : {}),
    },
    {
      href: "/account/viewings",
      label: "Viewings",
      hint: "Requests, appointments and your hours",
      icon: CalendarDays,
    },
  ];

  if (session.isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-[74px] rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-wrap items-center gap-3">
        <Link
          href="/post-property"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-emerald-700 px-5 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
        >
          <HousePlus className="size-4" />
          Post a property
        </Link>
        <Link
          href="/search?type=SALE"
          className="inline-flex h-11 items-center rounded-full border px-5 text-sm font-medium transition-colors hover:bg-slate-50"
        >
          Browse properties
        </Link>
      </section>

      {isAgent ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-[0.08em] text-slate-500 uppercase">
            Agent workspace
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {agentTiles.map((tile) => (
              <TileLink key={tile.href} tile={tile} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-[0.08em] text-slate-500 uppercase">
          Your account
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {tiles.map((tile) => (
            <TileLink key={tile.href} tile={tile} />
          ))}
        </div>
      </section>

      {isStaff ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-[0.08em] text-slate-500 uppercase">
            Staff
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TileLink
              tile={{
                href: "/dashboard",
                label: "Admin",
                hint: "Listings, payments, agents and staff",
                icon: ShieldCheck,
              }}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
