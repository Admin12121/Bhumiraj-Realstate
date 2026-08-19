"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { ListingFeedQuery } from "@real-estate/contracts";
import { getListingFeed } from "../api/listings-api";
import { queryKeys } from "@/shared/query/query-keys";

export function useListingFeed(filters: Partial<ListingFeedQuery> = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.listings.feed(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      getListingFeed(
        { ...filters, ...(pageParam ? { cursor: pageParam } : {}), limit: 10 },
        signal,
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
    // Changing a filter keeps the current results on screen while the next set
    // loads. Without this the list empties to a skeleton and snaps back, and
    // the map briefly loses its markers and flies somewhere in between.
    placeholderData: (previous) => previous,
  });
}
