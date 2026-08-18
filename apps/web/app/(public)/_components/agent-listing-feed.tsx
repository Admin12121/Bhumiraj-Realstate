"use client"

import { useEffect, useMemo, useRef } from "react"
import { useListingFeed } from "@/features/listings/queries/use-listing-feed"
import { PropertyPost, type PropertyPostData } from "@/app/_components/property-post"
import { formatMinorAmount } from "@/shared/utilities/money"

type FeedListing = ReturnType<
  typeof useListingFeed
>["data"] extends infer T
  ? T extends { pages: { items: (infer Item)[] }[] }
    ? Item
    : never
  : never

function toPost(listing: FeedListing): PropertyPostData {
  return {
    slug: listing.slug,
    title: listing.title,
    description: listing.description,
    images: listing.coverImageUrl ? [listing.coverImageUrl] : [],
    agent: {
      ...(listing.agent ? { id: listing.agent.id } : {}),
      name: listing.agent?.name ?? "Bhumiraj Estates",
      image: listing.agent?.image ?? null,
      verified: listing.agent?.verified ?? false,
    },
    publishedAt: listing.publishedAt ?? listing.createdAt,
    reference: listing.id.slice(0, 8).toUpperCase(),
    ...(listing.price
      ? {
          price: formatMinorAmount(
            listing.price.amountMinor,
            listing.price.currency,
          ),
        }
      : {}),
    location: `${listing.location.locality} | ${listing.location.district}`,
    propertyType: listing.propertyType,
    ...(listing.specifications.areaSqFt
      ? { area: `${listing.specifications.areaSqFt.toLocaleString()} sq ft` }
      : {}),
    category: listing.listingType === "RENT" ? "For rent" : "For sale",
    listingId: listing.id,
  }
}

function PostSkeleton() {
  return (
    <div className="rounded-2xl border p-4">
      <div className="flex items-center gap-3">
        <div className="size-10 animate-pulse rounded-full bg-[#f1f1ef]" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-40 animate-pulse rounded bg-[#f1f1ef]" />
          <div className="h-3 w-24 animate-pulse rounded bg-[#f1f1ef]" />
        </div>
      </div>
      <div className="mt-4 aspect-[4/3] w-full animate-pulse rounded-xl bg-[#f1f1ef]" />
    </div>
  )
}

/**
 * The agent's properties as a feed of posts. Paging comes from the listing feed
 * filtered by agent, so the page stays bounded however many they represent.
 */
export function AgentListingFeed({
  agentUserId,
  emptyMessage,
}: {
  agentUserId: string
  emptyMessage: string
}) {
  const feed = useListingFeed({ agentId: agentUserId })
  const sentinelRef = useRef<HTMLDivElement>(null)

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = feed

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasNextPage) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isFetchingNextPage) void fetchNextPage()
      },
      { rootMargin: "600px 0px" },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  const posts = useMemo(
    () => feed.data?.pages.flatMap((page) => page.items).map(toPost) ?? [],
    [feed.data],
  )

  if (feed.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <PostSkeleton />
        <PostSkeleton />
      </div>
    )
  }

  if (feed.isError) {
    return (
      <p className="rounded-2xl bg-[#f7f7f6] px-6 py-10 text-center text-sm text-[#636363]">
        These properties could not be loaded.
      </p>
    )
  }

  if (posts.length === 0) {
    return (
      <p className="rounded-2xl bg-[#f7f7f6] px-6 py-10 text-center text-sm text-[#636363]">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {posts.map((post) => (
        <PropertyPost key={post.slug} post={post} />
      ))}

      {isFetchingNextPage ? <PostSkeleton /> : null}
      <div ref={sentinelRef} className="h-8" />

      {!hasNextPage ? (
        <p className="py-2 text-center text-[13px] text-[#8a8a8a]">
          You&rsquo;ve reached the end
        </p>
      ) : null}
    </div>
  )
}
