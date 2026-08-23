"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gavel, Workflow } from "lucide-react";
import { getAdminOverview } from "@/features/admin/api/admin-api";
import { Frame, FramePanel } from "@/components/ui/frame";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PanelEmptyRow } from "./panel-layout";

const numberFormatter = new Intl.NumberFormat("en-IN");
const n = (value: number) => numberFormatter.format(value);

type Daily = {
  date: string;
  listings: number;
  bids: number;
  signups: number;
  events: number;
};

/** A card with its headline number and a visual, the way the reference does it. */
function MetricCard({
  label,
  value,
  meta,
  href,
  visual,
  footer,
}: {
  label: string;
  value: string;
  meta?: string;
  href: string;
  visual?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Frame className="outline-1 outline-offset-2 outline-neutral-300/50 transition-colors hover:outline-neutral-300 dark:outline-neutral-800/50">
      <FramePanel>
        <Link href={href} className="block">
          <div className="flex min-h-28 flex-col justify-between gap-6">
            <div className="flex items-start justify-between gap-4">
              <div className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
                {label}
              </div>
              <span className="size-2 rounded-full bg-foreground/45 shadow-[0_0_18px_color-mix(in_srgb,var(--foreground)_24%,transparent)]" />
            </div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="font-mono text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
                  {value}
                </div>
                {meta ? (
                  <div className="mt-2 text-xs text-muted-foreground">{meta}</div>
                ) : null}
              </div>
              {visual}
            </div>
          </div>
        </Link>
        {footer ? (
          <div className="mt-5 border-t pt-3 text-xs text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </FramePanel>
    </Frame>
  );
}

/** Thin trend line for a card; no axes, it is there to show shape. */
function Sparkline({ series }: { series: number[] }) {
  const peak = Math.max(...series, 1);
  return (
    <div
      className="flex h-12 w-32 items-end gap-px"
      aria-hidden
    >
      {series.map((point, index) => (
        <span
          key={index}
          className="flex-1 rounded-sm bg-foreground/70"
          style={{ height: `${Math.max((point / peak) * 100, 3)}%` }}
        />
      ))}
    </div>
  );
}

/** Semicircular gauge, matching the reference's capacity dials. */
function Gauge({
  ratio,
  caption,
}: {
  ratio: number;
  caption: string;
}) {
  const clamped = Math.min(Math.max(ratio, 0), 1);
  // Half-circle of radius 40 is pi * 40 long; the dash offset walks that arc.
  const arc = Math.PI * 40;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 56" className="h-16 w-28" aria-hidden>
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          className="text-muted"
        />
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          className="text-foreground"
          strokeDasharray={arc}
          strokeDashoffset={arc * (1 - clamped)}
        />
      </svg>
      <span className="-mt-4 font-mono text-lg font-semibold tabular-nums">
        {Math.round(clamped * 100)}%
      </span>
      <span className="mt-1 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
        {caption}
      </span>
    </div>
  );
}

function heatColour(value: number, peak: number): string {
  if (value === 0) return "bg-muted/70";
  const share = value / Math.max(peak, 1);
  if (share > 0.66) return "bg-emerald-500";
  if (share > 0.33) return "bg-emerald-400";
  return "bg-emerald-300";
}

export function AdminOverview() {
  const overview = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: ({ signal }) => getAdminOverview(signal),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  if (overview.isLoading) {
    return (
      <div className="rounded-xl border bg-background p-10 text-center text-sm text-muted-foreground">
        Loading platform metrics…
      </div>
    );
  }
  if (overview.isError || !overview.data) {
    return (
      <div className="rounded-xl border bg-background p-10 text-center text-sm text-destructive">
        Could not load the administration overview.
      </div>
    );
  }

  const { counts, recentActivity, pendingListings } = overview.data;
  const daily: Daily[] = overview.data.daily ?? [];

  const pipeline =
    counts.paymentsAwaitingReview +
    counts.listingsAwaitingAgent +
    counts.openAgentOffers +
    counts.pendingReviews;

  const windowListings = daily.reduce((sum, day) => sum + day.listings, 0);
  const peakEvents = Math.max(...daily.map((day) => day.events), 1);
  const peakActivity = Math.max(
    ...daily.map((day) => day.listings + day.bids + day.signups),
    1,
  );

  // Share of published listings that already have an agent representing them.
  const agentCoverage =
    counts.activeListings === 0
      ? 0
      : Math.min(
          (counts.activeListings - counts.listingsAwaitingAgent) /
            counts.activeListings,
          1,
        );
  const verifiedShare =
    counts.totalUsers === 0 ? 0 : counts.verifiedUsers / counts.totalUsers;

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <MetricCard
          label="Work queue"
          value={n(pipeline)}
          meta="Items waiting on a person right now."
          href="/dashboard/payments"
          visual={
            <Sparkline series={daily.slice(-20).map((day) => day.events)} />
          }
          footer={
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              <span>
                Payments{" "}
                <strong className="font-medium text-foreground tabular-nums">
                  {n(counts.paymentsAwaitingReview)}
                </strong>
              </span>
              <span>
                Needs agent{" "}
                <strong className="font-medium text-foreground tabular-nums">
                  {n(counts.listingsAwaitingAgent)}
                </strong>
              </span>
              <span>
                Reports{" "}
                <strong className="font-medium text-foreground tabular-nums">
                  {n(counts.pendingReviews)}
                </strong>
              </span>
            </span>
          }
        />

        <MetricCard
          label="Agent coverage"
          value={n(counts.activeListings)}
          meta="Published listings, and how many have an agent."
          href="/dashboard/listings"
          visual={<Gauge ratio={agentCoverage} caption="represented" />}
          footer={
            <span>
              {n(counts.verifiedAgents)} verified agents ·{" "}
              {n(counts.liveAuctions)} live auctions
            </span>
          }
        />

        <MetricCard
          label="Verified accounts"
          value={n(counts.totalUsers)}
          meta="Accounts on the platform, and how many are verified."
          href="/dashboard/users"
          visual={<Gauge ratio={verifiedShare} caption="verified" />}
          footer={
            <span>
              {n(daily.reduce((sum, day) => sum + day.signups, 0))} new in the
              last {daily.length} days
            </span>
          }
        />
      </div>

      <Frame className="outline-1 outline-offset-2 outline-neutral-300/50 dark:outline-neutral-800/50">
        <FramePanel>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                Marketplace pulse
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                New listings, bids and signups over the last {daily.length}{" "}
                days.
              </p>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-emerald-500" />
                Listings
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-sky-500" />
                Bids
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-violet-500" />
                Signups
              </span>
            </div>
          </div>

          <div className="mt-6 flex h-40 items-end gap-[3px]">
            {daily.map((day) => {
              const total = day.listings + day.bids + day.signups;
              const height = (total / peakActivity) * 100;
              return (
                <div
                  key={day.date}
                  className="flex h-full flex-1 flex-col justify-end gap-px"
                  title={`${day.date} · ${total} event${total === 1 ? "" : "s"}`}
                >
                  {total === 0 ? (
                    <span className="h-[2px] w-full rounded-sm bg-muted" />
                  ) : (
                    <span
                      className="flex w-full flex-col-reverse overflow-hidden rounded-sm"
                      style={{ height: `${Math.max(height, 2)}%` }}
                    >
                      <span
                        className="w-full bg-emerald-500"
                        style={{ flexGrow: day.listings }}
                      />
                      <span
                        className="w-full bg-sky-500"
                        style={{ flexGrow: day.bids }}
                      />
                      <span
                        className="w-full bg-violet-500"
                        style={{ flexGrow: day.signups }}
                      />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground tabular-nums">
            <span>{daily[0]?.date ?? ""}</span>
            <span>{n(windowListings)} listings in window</span>
            <span>{daily[daily.length - 1]?.date ?? ""}</span>
          </div>
        </FramePanel>
      </Frame>

      <Frame className="outline-1 outline-offset-2 outline-neutral-300/50 dark:outline-neutral-800/50">
        <FramePanel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                Staff activity
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {daily.length} day administrative activity, from the audit log.
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="h-3 w-1.5 rounded-sm bg-muted" />
                None
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-3 w-1.5 rounded-sm bg-emerald-300" />
                Light
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-3 w-1.5 rounded-sm bg-emerald-500" />
                Busy
              </span>
            </div>
          </div>
          <div
            className="mt-5 grid items-end gap-[3px]"
            style={{
              gridTemplateColumns: `repeat(${daily.length || 1}, minmax(0, 1fr))`,
            }}
            aria-label="Staff activity heatmap"
          >
            {daily.map((day) => (
              <span
                key={day.date}
                className={`block h-16 w-full min-w-0 rounded-sm ${heatColour(day.events, peakEvents)} opacity-90 transition-opacity hover:opacity-70`}
                title={`${day.date} · ${day.events} event${day.events === 1 ? "" : "s"}`}
              />
            ))}
          </div>
        </FramePanel>
      </Frame>

      <div className="grid gap-4 xl:grid-cols-2">
        <Frame>
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <h2 className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              Recent activity
            </h2>
            <Link
              href="/dashboard/audit"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              View audit log
            </Link>
          </div>
          <Table variant="card">
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead className="w-40">Actor</TableHead>
                <TableHead className="w-32 text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentActivity.slice(0, 6).map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="max-w-0">
                    <p className="truncate font-medium">
                      {entry.action.replace(/_/g, " ").toLowerCase()}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {entry.entityType}
                    </p>
                  </TableCell>
                  <TableCell className="truncate text-sm text-muted-foreground">
                    {entry.actorName ?? "System"}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
              <PanelEmptyRow
                colSpan={3}
                when={recentActivity.length === 0}
                icon={Workflow}
                title="No activity yet"
                description="Staff actions appear here as they happen."
              />
            </TableBody>
          </Table>
        </Frame>

        <Frame>
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <h2 className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              Oldest pending listings
            </h2>
            <Link
              href="/dashboard/listings"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Open queue
            </Link>
          </div>
          <Table variant="card">
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead className="w-40">Owner</TableHead>
                <TableHead className="w-32 text-right">Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingListings.slice(0, 6).map((listing) => (
                <TableRow key={listing.id}>
                  <TableCell className="max-w-0">
                    <p className="truncate font-medium">{listing.title}</p>
                  </TableCell>
                  <TableCell className="truncate text-sm text-muted-foreground">
                    {listing.ownerName}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {new Date(listing.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
              <PanelEmptyRow
                colSpan={3}
                when={pendingListings.length === 0}
                icon={Gavel}
                title="Queue is clear"
                description="No listing is waiting for review."
              />
            </TableBody>
          </Table>
        </Frame>
      </div>
    </div>
  );
}
