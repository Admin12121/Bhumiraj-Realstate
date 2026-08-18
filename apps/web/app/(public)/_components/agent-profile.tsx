"use client"

import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { BadgeCheck, Building2, MessageCircle, Star, Users } from "lucide-react"
import { agentProfileDetailSchema } from "@real-estate/contracts"
import { useSession } from "@real-estate/auth/client"
import { apiRequest } from "@/shared/http/api"
import { followProfile, unfollowProfile } from "@/features/profiles/api/profiles-api"
import { AgentListingFeed } from "./agent-listing-feed"

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={`size-3.5 ${
            index < Math.round(rating)
              ? "fill-amber-500 text-amber-500"
              : "text-slate-300"
          }`}
        />
      ))}
    </span>
  )
}

/** Public agent page: who they are, their standing, and what they represent. */
export function AgentProfile({ userId }: { userId: string }) {
  const session = useSession()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ["agent-profile", userId],
    queryFn: ({ signal }) =>
      apiRequest(`/profiles/agents/${userId}`, {
        method: "GET",
        schema: agentProfileDetailSchema,
        signal,
      }),
  })

  const follow = useMutation({
    mutationFn: (following: boolean) =>
      following ? unfollowProfile(userId) : followProfile(userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["agent-profile", userId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  if (query.isPending) {
    return <p className="p-10 text-sm text-slate-500">Loading agent…</p>
  }
  if (query.isError || !query.data) {
    return <p className="p-10 text-sm text-slate-500">Agent not found.</p>
  }

  const agent = query.data

  return (
    <main className="mx-auto w-full max-w-site px-6 py-10 lg:px-8 2xl:px-12">
      <header className="flex flex-col gap-6 border-b pb-8 sm:flex-row sm:items-start">
        <span className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-full bg-[#efece9] text-2xl font-semibold text-[#5b524c]">
          {agent.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={agent.image} alt="" className="size-full object-cover" />
          ) : (
            agent.name.slice(0, 1).toUpperCase()
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {agent.name}
            </h1>
            {agent.verified ? (
              <BadgeCheck className="size-5 text-emerald-700" />
            ) : null}
            {agent.availabilityStatus === "AVAILABLE" ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
                Available
              </span>
            ) : null}
          </div>

          {agent.headline ? (
            <p className="mt-1 text-[15px] text-slate-600">{agent.headline}</p>
          ) : null}

          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div className="flex items-center gap-1.5">
              <Stars rating={agent.averageRating} />
              <dd className="font-medium">{agent.averageRating.toFixed(1)}</dd>
              <dt className="text-slate-500">
                ({agent.reviewCount} review{agent.reviewCount === 1 ? "" : "s"})
              </dt>
            </div>
            <div className="flex items-center gap-1.5">
              <Building2 className="size-4 text-slate-400" />
              <dd className="font-medium">{agent.listings.length}</dd>
              <dt className="text-slate-500">properties</dt>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="size-4 text-slate-400" />
              <dd className="font-medium">{agent.followerCount}</dd>
              <dt className="text-slate-500">followers</dt>
            </div>
          </dl>
        </div>

        {!agent.isSelf ? (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              disabled={follow.isPending || !session.data}
              onClick={() => follow.mutate(agent.followedByMe)}
              className="inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {agent.followedByMe ? "Following" : "Follow"}
            </button>
            <Link
              href={`/account/messages?agent=${agent.userId}`}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-emerald-700 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
            >
              <MessageCircle className="size-4" />
              Message
            </Link>
          </div>
        ) : null}
      </header>

      {agent.about ? (
        <section className="border-b py-8">
          <h2 className="text-lg font-semibold">About</h2>
          <p className="mt-3 max-w-[70ch] text-[15px] leading-7 text-slate-600">
            {agent.about}
          </p>
        </section>
      ) : null}

      <section className="border-b py-8">
        <h2 className="text-lg font-semibold">
          Properties represented ({agent.listings.length})
        </h2>

        <div className="mt-5 max-w-[680px]">
          <AgentListingFeed
            agentUserId={userId}
            emptyMessage="This agent has no published properties yet."
          />
        </div>
      </section>

      {agent.reviews.length > 0 ? (
        <section className="py-8">
          <h2 className="text-lg font-semibold">Reviews</h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {agent.reviews.map((review) => (
              <li key={review.id} className="rounded-2xl border p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">
                    {review.authorName}
                  </span>
                  <Stars rating={review.rating} />
                </div>
                {review.comment ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {review.comment}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  )
}
