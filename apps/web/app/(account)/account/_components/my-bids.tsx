"use client";

import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { InfiniteScrollTrigger } from "@/shared/components/infinite-scroll-trigger";
import { apiRequest } from "@/shared/http/api";
import { formatMinorAmount } from "@/shared/utilities/money";
import { Gavel } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Frame } from "@/components/ui/frame";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
    <Frame>
      <div className="overflow-x-auto">
        <Table variant="card" className="min-w-[680px]">
          <TableHeader>
            <TableRow>
              <TableHead className="p-4">Auction</TableHead>
              <TableHead className="p-4">Bid</TableHead>
              <TableHead className="p-4">Status</TableHead>
              <TableHead className="p-4">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((bid) => (
              <TableRow key={bid.id}>
                <TableCell className="p-4">
                  <Link
                    className="font-semibold hover:text-emerald-700"
                    href={`/auctions/${bid.auctionId}`}
                  >
                    {bid.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Sequence #{bid.sequence}
                  </p>
                </TableCell>
                <TableCell className="p-4 tabular-nums">
                  {formatMinorAmount(bid.amountMinor, bid.currency)}
                </TableCell>
                <TableCell className="p-4">
                  <Badge size="sm" variant="secondary">
                    {bid.status}
                  </Badge>
                </TableCell>
                <TableCell className="p-4 text-xs text-muted-foreground">
                  {new Date(bid.acceptedAt).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
            {!items.length && !query.isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="p-0">
                  <Empty className="py-14">
                    <EmptyMedia variant="icon">
                      <Gavel />
                    </EmptyMedia>
                    <EmptyTitle>No bids yet</EmptyTitle>
                    <EmptyDescription>
                      Auctions you take part in will be listed here.
                    </EmptyDescription>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <InfiniteScrollTrigger
        hasNextPage={Boolean(query.hasNextPage)}
        isFetchingNextPage={query.isFetchingNextPage}
        fetchNextPage={query.fetchNextPage}
        label="Loading bid history…"
      />
    </Frame>
  );
}
