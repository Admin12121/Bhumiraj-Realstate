"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import type { FormEvent } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { BadgeCheck, Building2, Search, Star, Users } from "lucide-react"
import { queryKeys } from "@/shared/query/query-keys"
import { getPublicAgents } from "@/features/profiles/api/profiles-api"
import { Frame, FrameFooter, FramePanel } from "@/components/ui/frame"

function AgentCard({
  agent,
}: {
  agent: {
    id: string
    userId: string
    name: string
    username: string | null
    image: string | null
    headline: string | null
    about: string | null
    verified: boolean
    averageRating: number
    listingCount: number
    followerCount: number
  }
}) {
  const stats = [
    { icon: Star, label: "Rating", value: agent.averageRating.toFixed(1) },
    { icon: Building2, label: "Listings", value: String(agent.listingCount) },
    { icon: Users, label: "Followers", value: String(agent.followerCount) },
  ]

  return (
    <article className="min-w-0">
      <Frame className="h-full w-full transition-shadow duration-200 hover:shadow-card-hover">
        <FramePanel className="p-5">
          <div className="flex items-start gap-4">
            <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-[#efece9] text-[18px] font-semibold text-[#5b524c]">
              {agent.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={agent.image} alt="" className="size-full object-cover" />
              ) : (
                agent.name.slice(0, 1).toUpperCase()
              )}
            </span>

            <div className="min-w-0 flex-1">
              <Link
                href={`/agents/${agent.userId}`}
                className="flex items-center gap-1.5 text-[16px] leading-normal font-medium tracking-[-0.015em] text-[#1d1919] hover:underline"
              >
                <span className="truncate">{agent.name}</span>
                {agent.verified ? (
                  <BadgeCheck
                    className="size-4 shrink-0 text-emerald-700"
                    aria-label="Verified agent"
                  />
                ) : null}
              </Link>
              <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-[#737373]">
                {agent.headline ||
                  agent.about ||
                  "Verified real-estate professional."}
              </p>
            </div>
          </div>
        </FramePanel>

        <FrameFooter className="px-5 py-4">
          <dl className="grid w-full grid-cols-3 gap-4">
            {stats.map((stat) => (
              <div key={stat.label} className="min-w-0">
                <dt className="text-[11px] leading-normal text-[#8a8a8a]">
                  {stat.label}
                </dt>
                <dd className="truncate text-[14px] leading-normal font-medium text-[#1d1919]">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </FrameFooter>
      </Frame>
    </article>
  )
}

function AgentCardSkeleton() {
  return (
    <article className="min-w-0">
      <Frame className="h-full w-full">
        <FramePanel className="p-5">
          <div className="flex items-start gap-4">
            <div className="size-14 shrink-0 animate-pulse rounded-full bg-[#f1f1ef]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 animate-pulse rounded bg-[#f1f1ef]" />
              <div className="h-3 w-full animate-pulse rounded bg-[#f1f1ef]" />
            </div>
          </div>
        </FramePanel>
        <FrameFooter className="px-5 py-4">
          <div className="grid w-full grid-cols-3 gap-4">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="space-y-1.5">
                <div className="h-2.5 w-12 animate-pulse rounded bg-[#f1f1ef]" />
                <div className="h-3.5 w-10 animate-pulse rounded bg-[#f1f1ef]" />
              </div>
            ))}
          </div>
        </FrameFooter>
      </Frame>
    </article>
  )
}

export function AgentsDirectory() {
  const [draftSearch, setDraftSearch] = useState("")
  const [search, setSearch] = useState("")
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const query = useInfiniteQuery({
    queryKey: queryKeys.profiles.agents(search),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      getPublicAgents(
        {
          ...(pageParam ? { cursor: pageParam } : {}),
          limit: 18,
          ...(search ? { search } : {}),
        },
        signal,
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 60_000,
  })

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query

  useEffect(() => {
    const node = loadMoreRef.current
    if (!node || !hasNextPage) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isFetchingNextPage) void fetchNextPage()
      },
      { rootMargin: "500px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  const agents = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  )

  function submit(event: FormEvent) {
    event.preventDefault()
    setSearch(draftSearch.trim())
  }

  return (
    <div
      id="main-content"
      className="mx-auto w-full max-w-site px-6 pt-10 pb-24 lg:px-8 2xl:px-12"
    >
      <header className="flex w-full flex-col items-start justify-between gap-5 lg:flex-row lg:items-center lg:gap-6">
        <h1 className="shrink-0 text-[22px] leading-normal font-medium tracking-[-.75px] text-[#221811] md:text-[24px] md:tracking-[-1px]">
          Find a trusted <em className="font-medium">property agent</em>
        </h1>

        {/* Matches the search frame used on the home hero. */}
        <form
          onSubmit={submit}
          aria-label="Search agents"
          className="flex h-12 w-full min-w-0 items-center gap-1 rounded-full border border-black/[.12] bg-white p-px shadow-[0_2px_12px_rgba(0,0,0,.08)] transition-shadow duration-200 hover:shadow-[0_3px_16px_rgba(0,0,0,.10)] lg:w-[380px]"
        >
          <label className="sr-only" htmlFor="agent-search">
            Search agents
          </label>
          <Search className="ml-4 size-4 shrink-0 text-[#666]" strokeWidth={1.8} />
          <input
            id="agent-search"
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            placeholder="Search by name or username"
            maxLength={100}
            className="min-w-0 flex-1 bg-transparent px-3 text-[14px] font-medium text-[#1d1919] outline-none placeholder:text-[#737373]"
          />
          <button
            type="submit"
            aria-label="Search"
            className="mr-px grid size-11 shrink-0 place-items-center rounded-full bg-[#171717] text-white transition-colors hover:bg-black"
          >
            <Search className="size-4" strokeWidth={2} />
          </button>
        </form>
      </header>

      {query.isPending ? (
        <div className="mt-9 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <AgentCardSkeleton key={index} />
          ))}
        </div>
      ) : query.isError ? (
        <p className="mt-9 rounded-2xl bg-[#f7f7f6] px-6 py-14 text-center text-[14px] text-[#636363]">
          The agent directory is temporarily unavailable.
        </p>
      ) : agents.length === 0 ? (
        <div className="mt-9 flex flex-col items-center gap-2 rounded-2xl bg-[#f7f7f6] px-6 py-14 text-center">
          <p className="text-[15px] font-medium text-[#202020]">
            {search ? "No agents match that search" : "No agents listed yet"}
          </p>
          <p className="max-w-[340px] text-[13px] leading-5 text-[#8a8a8a]">
            {search
              ? "Try a different name, or clear the search to see everyone."
              : "Agents are appointed by Bhumiraj and appear here once verified."}
          </p>
        </div>
      ) : (
        <div className="mt-9 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}

      <div ref={loadMoreRef} className="h-10" />
    </div>
  )
}
