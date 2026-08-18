"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Building2,
  CircleAlert,
  Gavel,
  BadgeDollarSign,
  Send,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  Workflow,
} from "lucide-react";
import { getAdminOverview } from "@/features/admin/api/admin-api";

const numberFormatter = new Intl.NumberFormat("en-IN");

export function AdminOverview() {
  const overview = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: ({ signal }) => getAdminOverview(signal),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  if (overview.isLoading) {
    return <div className="surface rounded-2xl p-10 text-center text-sm text-slate-500">Loading platform metricsâ€¦</div>;
  }
  if (overview.isError || !overview.data) {
    return <div className="surface rounded-2xl p-10 text-center text-sm text-red-600">Could not load the administration overview.</div>;
  }

  const { counts } = overview.data;

  // Queues that need a decision are listed before ambient totals.
  const queues = [
    [
      "Payments to verify",
      counts.paymentsAwaitingReview,
      BadgeDollarSign,
      "/admin/payments",
    ],
    [
      "Awaiting an agent",
      counts.listingsAwaitingAgent,
      UserPlus,
      "/admin/payments",
    ],
    ["Offers with agents", counts.openAgentOffers, Send, "/admin/payments"],
    ["Pending reviews", counts.pendingReviews, CircleAlert, "/admin/moderation"],
  ] as const;

  const cards = [
    ["Active listings", counts.activeListings, Building2, "/admin/listings"],
    ["Live auctions", counts.liveAuctions, Gavel, "/admin/auctions"],
    ["Verified users", counts.verifiedUsers, UserCheck, "/admin/users"],
    ["Total users", counts.totalUsers, Users, "/admin/users"],
    ["Verified agents", counts.verifiedAgents, ShieldCheck, "/admin/agents"],
    ["Bids today", counts.bidsToday, Activity, "/admin/auctions"],
    ["Outbox backlog", counts.outboxBacklog, Workflow, "/admin/audit"],
  ] as const;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-500">
          Needs attention
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {queues.map(([label, value, Icon, href]) => (
            <Link
              key={label}
              href={href}
              className="surface rounded-2xl p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`flex size-10 items-center justify-center rounded-xl ${
                    value > 0
                      ? "bg-amber-50 text-amber-700"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  <Icon className="size-5" />
                </span>
                {value > 0 ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    Action needed
                  </span>
                ) : (
                  <span className="text-xs font-medium text-slate-400">
                    Clear
                  </span>
                )}
              </div>
              <p className="mt-5 text-3xl font-bold">
                {numberFormatter.format(value)}
              </p>
              <p className="mt-1 text-sm text-slate-500">{label}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, Icon, href]) => (
          <Link key={label} href={href} className="surface rounded-2xl p-5 transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Icon className="size-5" />
              </span>
              <span className="text-xs font-semibold text-emerald-700">Live data</span>
            </div>
            <p className="mt-5 text-3xl font-bold">{numberFormatter.format(value)}</p>
            <p className="mt-1 text-sm text-slate-500">{label}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <section className="surface overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h2 className="font-semibold">Recent activity</h2>
              <p className="mt-1 text-xs text-slate-500">Immutable administrative and marketplace events.</p>
            </div>
            <Link href="/admin/audit" className="text-xs font-semibold text-emerald-700">View audit log</Link>
          </div>
          <div className="divide-y">
            {overview.data.recentActivity.map((item) => (
              <div key={item.id} className="flex items-start gap-3 px-5 py-4">
                <span className="mt-1 size-2 rounded-full bg-emerald-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{item.action.replaceAll("_", " ")}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {item.actorName || "System"} Â· {item.entityType} Â· {item.entityId}
                  </p>
                </div>
                <time className="shrink-0 text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleString()}</time>
              </div>
            ))}
            {!overview.data.recentActivity.length && (
              <p className="p-8 text-center text-sm text-slate-500">No activity recorded.</p>
            )}
          </div>
        </section>

        <section className="surface overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h2 className="font-semibold">Oldest pending listings</h2>
              <p className="mt-1 text-xs text-slate-500">Review the longest-waiting submissions first.</p>
            </div>
            <Link href="/admin/listings" className="text-xs font-semibold text-emerald-700">Open queue</Link>
          </div>
          <div className="divide-y">
            {overview.data.pendingListings.map((listing) => (
              <Link key={listing.id} href="/admin/listings" className="block px-5 py-4 hover:bg-slate-50">
                <p className="line-clamp-1 text-sm font-semibold">{listing.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {listing.ownerName} Â· submitted {new Date(listing.createdAt).toLocaleString()}
                </p>
              </Link>
            ))}
            {!overview.data.pendingListings.length && (
              <p className="p-8 text-center text-sm text-slate-500">No listings await review.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
