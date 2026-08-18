"use client"

import Link from "next/link"
import { useInfiniteQuery } from "@tanstack/react-query"
import { BadgeCheck, Building2, MapPin, Star } from "lucide-react"
import { getPublicAgents } from "@/features/profiles/api/profiles-api"
import { queryKeys } from "@/shared/query/query-keys"
import { MapSurface, type MapMarkerData } from "./property-map"
import {
  Card,
  CardFrame,
  CardFrameAction,
  CardFrameHeader,
  CardFrameTitle,
} from "@/components/ui/card"

/**
 * Map teaser for the feed rail. The interactive map lives on /search, so this
 * stays a static entry point rather than a second MapLibre instance per page.
 */
export function RailMap({
  markers,
  focusSlug,
}: {
  markers: MapMarkerData[]
  focusSlug: string | null
}) {
  return (
    <CardFrame>
      <CardFrameHeader>
        <CardFrameTitle className="flex items-center gap-2 text-[15px]">
          <MapPin className="size-4 text-emerald-700" strokeWidth={1.8} />
          Explore on the map
        </CardFrameTitle>
        <CardFrameAction>
          <Link
            href="/search?type=SALE"
            className="text-[13px] font-medium text-emerald-800 hover:underline"
          >
            Open
          </Link>
        </CardFrameAction>
      </CardFrameHeader>

      <Card className="overflow-hidden p-0">
        <MapSurface
          markers={markers}
          focusSlug={focusSlug}
          hoveredSlug={focusSlug}
          className="aspect-[4/3] h-auto rounded-none shadow-none ring-0"
        />
      </Card>
    </CardFrame>
  )
}

function AgentRow({
  agent,
}: {
  agent: {
    id: string
    userId: string
    name: string
    image: string | null
    verified: boolean
    averageRating: number
    listingCount: number
  }
}) {
  return (
    <Link
      href={`/agents/${agent.userId}`}
      className="flex min-w-0 items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-black/[.03]"
    >
      <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#efece9] text-[13px] font-semibold text-[#5b524c]">
        {agent.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={agent.image} alt="" className="size-full object-cover" />
        ) : (
          agent.name.slice(0, 1).toUpperCase()
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1">
          <span className="truncate text-[14px] font-medium text-[#1d1919]">
            {agent.name}
          </span>
          {agent.verified ? (
            <BadgeCheck className="size-3.5 shrink-0 text-emerald-700" />
          ) : null}
        </span>
        <span className="flex items-center gap-2 text-[12px] text-[#8a8a8a]">
          <span className="inline-flex items-center gap-1">
            <Star className="size-3 fill-amber-500 text-amber-500" />
            {agent.averageRating.toFixed(1)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Building2 className="size-3" />
            {agent.listingCount}
          </span>
        </span>
      </span>
    </Link>
  )
}

/** Verified agents rail, mirroring the directory ordering. */
export function RailAgents() {
  const query = useInfiniteQuery({
    queryKey: queryKeys.profiles.agents(""),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      getPublicAgents(
        { ...(pageParam ? { cursor: pageParam } : {}), limit: 5 },
        signal,
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 60_000,
  })

  const agents = (query.data?.pages.flatMap((page) => page.items) ?? []).slice(
    0,
    5,
  )

  return (
    <CardFrame>
      <CardFrameHeader>
        <CardFrameTitle className="text-[15px]">Verified agents</CardFrameTitle>
        <CardFrameAction>
          <Link
            href="/agents"
            className="text-[13px] font-medium text-emerald-800 hover:underline"
          >
            See all
          </Link>
        </CardFrameAction>
      </CardFrameHeader>

      <Card className="px-3 py-3">
        {query.isPending ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex items-center gap-3 px-2 py-2">
                <div className="size-9 shrink-0 animate-pulse rounded-full bg-[#f1f1ef]" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-[#f1f1ef]" />
                  <div className="h-2.5 w-1/3 animate-pulse rounded bg-[#f1f1ef]" />
                </div>
              </div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <p className="px-2 py-3 text-[13px] text-[#8a8a8a]">
            No verified agents listed yet.
          </p>
        ) : (
          <div className="flex flex-col">
            {agents.map((agent) => (
              <AgentRow key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </Card>
    </CardFrame>
  )
}
