"use client";

import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { InfiniteScrollTrigger } from "@/shared/components/infinite-scroll-trigger";
import { apiRequest } from "@/shared/http/api";
import { formatMinorAmount } from "@/shared/utilities/money";

const myBidsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      auctionId: z.string(),
      title: z.string(),
      slug: z.string(),
      amountMinor: z.string(),
      currency: z.string(),
      sequence: z.number(),
      status: z.string(),
      acceptedAt: z.string(),
    }),
  ),
  hasMore: z.boolean(),
  nextCursor: z.string().nullable(),
});

export function MyBids() {
  const query = useInfiniteQuery({
    queryKey: ["my-bids"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => {
      const parameters = new URLSearchParams({ limit: "20" });
      if (pageParam) parameters.set("cursor", pageParam);
      return apiRequest(`/auctions/mine/bids?${parameters}`, {
        method: "GET",
        schema: myBidsSchema,
        signal,
      });
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="surface overflow-hidden rounded-2xl">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="p-4">Auction</th>
              <th className="p-4">Bid</th>
              <th className="p-4">Status</th>
              <th className="p-4">Date</th>
            </tr>
          </thead>
          <tbody>
            {items.map((bid) => (
              <tr key={bid.id} className="border-t">
                <td className="p-4">
                  <Link
                    className="font-semibold hover:text-emerald-700"
                    href={`/auctions/${bid.auctionId}`}
                  >
                    {bid.title}
                  </Link>
                  <p className="text-xs text-slate-500">
                    Sequence #{bid.sequence}
                  </p>
                </td>
                <td className="p-4">
                  {formatMinorAmount(bid.amountMinor, bid.currency)}
                </td>
                <td className="p-4">{bid.status}</td>
                <td className="p-4 text-xs text-slate-500">
                  {new Date(bid.acceptedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!items.length && !query.isLoading && (
        <p className="p-10 text-center text-sm text-slate-500">
          You have not placed a bid.
        </p>
      )}

      <InfiniteScrollTrigger
        hasNextPage={Boolean(query.hasNextPage)}
        isFetchingNextPage={query.isFetchingNextPage}
        fetchNextPage={query.fetchNextPage}
        label="Loading bid historyâ€¦"
      />
    </div>
  );
}
