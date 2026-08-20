"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { io } from "socket.io-client";
import {
  auctionEventSchema,
  type AuctionSnapshot,
} from "@real-estate/contracts";
import {
  CheckCircle2,
  Clock3,
  Gavel,
  ShieldCheck,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAuction,
  getBids,
  placeBid,
  registerAuction,
} from "@/features/auctions/api/auctions-api";
import { queryKeys } from "@/shared/query/query-keys";
import { formatMinorAmount } from "@/shared/utilities/money";
import { errorMessage } from "@/shared/http/error-message";

function minorToInput(value: bigint) {
  const whole = value / 100n;
  const decimal = (value % 100n).toString().padStart(2, "0");
  return decimal === "00" ? whole.toString() : `${whole}.${decimal}`;
}

function parseMajorAmount(value: string) {
  const normalized = value.trim().replaceAll(",", "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Enter a valid NPR amount with at most two decimal places.");
  }
  const [whole, decimals = ""] = normalized.split(".");
  return (
    BigInt(whole || "0") * 100n +
    BigInt(decimals.padEnd(2, "0"))
  ).toString();
}

function subscribeClock(callback: () => void) {
  const timer = window.setInterval(callback, 1_000);
  return () => window.clearInterval(timer);
}

function currentTime() {
  return Date.now();
}

function useCountdown(endsAt?: string) {
  const now = useSyncExternalStore(subscribeClock, currentTime, () => 0);

  const remaining = Math.max(
    0,
    (endsAt ? new Date(endsAt).getTime() : 0) - now,
  );
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function LiveAuction({ auctionId }: { auctionId: string }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [connected, setConnected] = useState(false);
  const processedEvents = useRef(new Set<string>());

  const auction = useQuery({
    queryKey: queryKeys.auctions.detail(auctionId),
    queryFn: () => getAuction(auctionId),
    refetchInterval: 30_000,
    staleTime: 0,
  });

  const bids = useInfiniteQuery({
    queryKey: queryKeys.auctions.bids(auctionId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => getBids(auctionId, pageParam, signal),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 0,
  });

  const bid = useMutation({
    mutationFn: () =>
      placeBid(auctionId, parseMajorAmount(amount), crypto.randomUUID()),
    onSuccess: (accepted) => {
      toast.success("Bid accepted");
      setAmount("");
      queryClient.setQueryData<AuctionSnapshot>(
        queryKeys.auctions.detail(auctionId),
        (current) =>
          current
            ? {
                ...current,
                currentAmountMinor: accepted.amountMinor,
                bidCount:
                  accepted.sequence > current.sequence
                    ? current.bidCount + 1
                    : current.bidCount,
                sequence: Math.max(current.sequence, accepted.sequence),
                eventSequence: Math.max(
                  current.eventSequence,
                  accepted.eventSequence,
                ),
                endsAt: accepted.endsAt,
                winningBidderDisplay: "You",
              }
            : current,
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.auctions.bids(auctionId),
      });
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  });

  const registration = useMutation({
    mutationFn: () => registerAuction(auctionId),
    onSuccess: () => {
      toast.success("Auction registration submitted");
      void queryClient.invalidateQueries({
        queryKey: queryKeys.auctions.detail(auctionId),
      });
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  });

  useEffect(() => {
    const socket = io("/realtime", {
      path: "/socket.io",
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("auction:join", { auctionId });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.auctions.detail(auctionId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.auctions.bids(auctionId),
      });
    });
    socket.on("disconnect", () => setConnected(false));

    socket.on("auction:event", (raw: unknown) => {
      const parsed = auctionEventSchema.safeParse(raw);
      if (!parsed.success || parsed.data.auctionId !== auctionId) return;
      const event = parsed.data;
      if (processedEvents.current.has(event.eventId)) return;
      processedEvents.current.add(event.eventId);
      if (processedEvents.current.size > 500) {
        const oldest = processedEvents.current.values().next().value;
        if (oldest) processedEvents.current.delete(oldest);
      }
      const current = queryClient.getQueryData<AuctionSnapshot>(
        queryKeys.auctions.detail(auctionId),
      );

      if (current && event.sequence > current.eventSequence + 1) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.auctions.detail(auctionId),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.auctions.bids(auctionId),
        });
        return;
      }

      queryClient.setQueryData<AuctionSnapshot>(
        queryKeys.auctions.detail(auctionId),
        (snapshot) => {
          if (!snapshot) return snapshot;

          if (
            event.type === "auction.bid.accepted" &&
            event.sequence > snapshot.eventSequence
          ) {
            return {
              ...snapshot,
              currentAmountMinor: event.data.amountMinor,
              bidCount: snapshot.bidCount + 1,
              sequence: event.data.sequence,
              eventSequence: event.sequence,
              endsAt: event.data.endsAt,
              winningBidderDisplay: event.data.bidderDisplay,
              serverTime: event.serverTime,
            };
          }
          if (event.type === "auction.status.changed") {
            return {
              ...snapshot,
              status: event.data.status,
              eventSequence: Math.max(
                snapshot.eventSequence,
                event.sequence,
              ),
              serverTime: event.serverTime,
            };
          }
          return snapshot;
        },
      );

      if (event.type === "auction.bid.accepted") {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.auctions.bids(auctionId),
        });
      }
    });

    return () => {
      socket.emit("auction:leave", { auctionId });
      socket.close();
    };
  }, [auctionId, queryClient]);

  const snapshot = auction.data;
  const countdown = useCountdown(snapshot?.endsAt);
  const minimum = snapshot
    ? snapshot.bidCount === 0
      ? BigInt(snapshot.startingAmountMinor)
      : BigInt(snapshot.currentAmountMinor) +
        BigInt(snapshot.minimumIncrementMinor)
    : 0n;
  const allBids = useMemo(
    () => bids.data?.pages.flatMap((page) => page.items) ?? [],
    [bids.data],
  );

  if (auction.isLoading) {
    return <main className="mx-auto max-w-7xl p-8">Loading live auction…</main>;
  }
  if (!snapshot) {
    return <main className="mx-auto max-w-7xl p-8">Auction unavailable.</main>;
  }

  return (
    <main id="main-content" className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="font-serif text-xl font-bold text-emerald-800">
            BHUMIRAJ ESTATES
          </Link>
          <div className="flex items-center gap-3">
            <span
              className={`hidden items-center gap-1.5 text-xs sm:flex ${connected ? "text-emerald-700" : "text-slate-500"}`}
            >
              {connected ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}
              {connected ? "Realtime connected" : "Reconnecting"}
            </span>
            <span className="flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">
              <span className="live-dot size-2 rounded-full bg-red-500" />
              {snapshot.status}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-7 lg:grid-cols-[1fr_390px]">
        <section className="space-y-5">
          <div className="surface overflow-hidden rounded-[24px]">
            <div className="relative aspect-[16/9] bg-slate-100">
              <Image
                src={snapshot.listing.coverImageUrl || "/assets/property-modern.svg"}
                fill
                alt={snapshot.listing.title}
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 780px"
                priority
              />
            </div>
            <div className="p-6">
              <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
                {snapshot.listing.title}
                {snapshot.listing.isVerified && (
                  <CheckCircle2 className="size-5 fill-blue-500 text-white" />
                )}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                {snapshot.listing.location.locality},{" "}
                {snapshot.listing.location.district}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Stat
                  icon={<Gavel />}
                  label="Current bid"
                  value={formatMinorAmount(snapshot.currentAmountMinor)}
                />
                <Stat
                  icon={<Users />}
                  label="Total bids"
                  value={String(snapshot.bidCount)}
                />
                <Stat icon={<Clock3 />} label="Time left" value={countdown} />
              </div>
            </div>
          </div>

          <section className="surface rounded-[24px] p-6">
            <h2 className="text-lg font-semibold">About this auction</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {snapshot.listing.description}
            </p>
            <div className="mt-4 flex items-start gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
              <ShieldCheck className="mt-0.5 size-5 shrink-0" />
              <span>
                Identity verification and any required auction deposit must be approved
                before a bid can be accepted. PostgreSQL commit time and auction state are
                authoritative.
              </span>
            </div>
          </section>
        </section>

        <aside className="space-y-5">
          <section className="surface rounded-[24px] p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Current bid
            </div>
            <div className="mt-1 text-3xl font-bold text-emerald-800">
              {formatMinorAmount(snapshot.currentAmountMinor)}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Minimum next bid: {formatMinorAmount(minimum.toString())}
            </div>

            {!snapshot.eligible ? (
              <button
                type="button"
                onClick={() => registration.mutate()}
                disabled={registration.isPending}
                className="brand-button mt-5 h-12 w-full rounded-xl font-semibold"
              >
                {snapshot.registered ? "Complete verification" : "Register to bid"}
              </button>
            ) : (
              <div className="mt-5 space-y-3">
                <label className="block text-sm font-semibold">
                  Your bid (NPR)
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    min={minorToInput(minimum)}
                    className="mt-2 h-12 w-full rounded-xl border px-4 text-lg font-semibold outline-none focus:border-emerald-600"
                    placeholder={minorToInput(minimum)}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => bid.mutate()}
                  disabled={
                    !amount || bid.isPending || snapshot.status !== "LIVE"
                  }
                  className="brand-button h-12 w-full rounded-xl font-semibold disabled:opacity-50"
                >
                  {bid.isPending ? "Submitting…" : "Place bid"}
                </button>
              </div>
            )}
            <p className="mt-4 text-[11px] leading-5 text-slate-500">
              A bid is final only after the API confirms the committed transaction. The
              browser and WebSocket stream never determine the winner.
            </p>
          </section>

          <section className="surface rounded-[24px] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Bid activity</h2>
              <span className="text-xs text-slate-500">
                Sequence {snapshot.sequence}
              </span>
            </div>
            <div className="max-h-[430px] space-y-2 overflow-y-auto">
              {allBids.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between rounded-xl p-3 text-sm ${item.mine ? "bg-emerald-50" : "bg-slate-50"}`}
                >
                  <div>
                    <p className="font-semibold">{item.bidderDisplay}</p>
                    <p className="text-[11px] text-slate-500">
                      {new Date(item.acceptedAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatMinorAmount(item.amountMinor)}</p>
                    <p className="text-[11px] text-slate-500">#{item.sequence}</p>
                  </div>
                </div>
              ))}
              {!allBids.length && (
                <p className="py-8 text-center text-sm text-slate-500">
                  No bids yet.
                </p>
              )}
            </div>
            {bids.hasNextPage && (
              <button
                type="button"
                onClick={() => bids.fetchNextPage()}
                disabled={bids.isFetchingNextPage}
                className="mt-4 w-full rounded-xl border py-2 text-sm font-semibold"
              >
                {bids.isFetchingNextPage ? "Loading…" : "Load earlier bids"}
              </button>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <span className="text-emerald-700 [&>svg]:size-5">{icon}</span>
      <p className="mt-3 text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
