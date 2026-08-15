"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { BadgeCheck, Building2, Search, Star, Users } from "lucide-react";
import { queryKeys } from "@/shared/query/query-keys";
import { getPublicAgents } from "@/features/profiles/api/profiles-api";

export function AgentsDirectory() {
  const [draftSearch, setDraftSearch] = useState("");
  const [search, setSearch] = useState("");
  const loadMoreRef = useRef<HTMLDivElement>(null);
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
  });
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasNextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "500px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const agents = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    setSearch(draftSearch.trim());
  }

  return (
    <main id="main-content" className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:py-12">
        <Link href="/" className="text-sm font-semibold text-emerald-700">
          â† Back to marketplace
        </Link>
        <div className="mt-6 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold text-emerald-700">Verified professionals</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Find a trusted property agent</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Browse verified agents, their active listings, ratings, and public profiles.
            </p>
          </div>
          <form onSubmit={submit} className="flex w-full max-w-md rounded-2xl border bg-white p-1.5 shadow-sm">
            <Search className="ml-3 mt-2.5 size-4 text-slate-400" />
            <label className="sr-only" htmlFor="agent-search">Search agents</label>
            <input
              id="agent-search"
              value={draftSearch}
              onChange={(event) => setDraftSearch(event.target.value)}
              placeholder="Search by name or username"
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
              maxLength={100}
            />
            <button className="brand-button rounded-xl px-4 py-2 text-sm font-semibold" type="submit">
              Search
            </button>
          </form>
        </div>

        {query.isLoading ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="surface h-60 animate-pulse rounded-3xl" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="surface mt-10 rounded-3xl p-8 text-center text-sm text-slate-600">
            Agent directory is temporarily unavailable.
          </div>
        ) : agents.length === 0 ? (
          <div className="surface mt-10 rounded-3xl p-10 text-center text-sm text-slate-600">
            No verified agents match this search.
          </div>
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <article key={agent.id} className="surface rounded-3xl p-5">
                <div className="flex items-start gap-4">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-emerald-50">
                    {agent.image ? (
                      <Image src={agent.image} alt="" fill sizes="64px" className="object-cover" />
                    ) : (
                      <span className="grid h-full place-items-center text-xl font-bold text-emerald-700">
                        {agent.name[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="flex items-center gap-1.5 truncate font-bold">
                      {agent.name}
                      <BadgeCheck className="size-4 shrink-0 fill-blue-500 text-white" aria-label="Verified agent" />
                    </h2>
                    <p className="truncate text-xs text-slate-500">
                      @{agent.username ?? agent.userId.slice(0, 8)}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                      {agent.headline || agent.about || "Verified real-estate professional."}
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center text-xs text-slate-600">
                  <span><Star className="mx-auto mb-1 size-4" />{agent.averageRating.toFixed(1)}</span>
                  <span><Building2 className="mx-auto mb-1 size-4" />{agent.listingCount} listings</span>
                  <span><Users className="mx-auto mb-1 size-4" />{agent.followerCount}</span>
                </div>
                <Link
                  href={`/users/${agent.userId}`}
                  className="mt-4 block rounded-xl border border-emerald-700 px-4 py-2.5 text-center text-sm font-semibold text-emerald-800"
                >
                  View profile
                </Link>
              </article>
            ))}
          </div>
        )}

        <div ref={loadMoreRef} className="h-16 text-center text-sm text-slate-500">
          {query.isFetchingNextPage ? "Loading more agentsâ€¦" : null}
        </div>
      </div>
    </main>
  );
}
