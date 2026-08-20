"use client"

import Link from "next/link"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  MapPin,
  MessageCircle,
  Star,
} from "lucide-react"
import { agentProfileDetailSchema } from "@real-estate/contracts"
import { useSession } from "@real-estate/auth/client"
import { apiRequest } from "@/shared/http/api"
import {
  followProfile,
  unfollowProfile,
} from "@/features/profiles/api/profiles-api"
import { Skeleton } from "@/components/ui/skeleton"
import { AgentListingFeed } from "./agent-listing-feed"
import { errorMessage } from "@/shared/http/error-message";

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

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[17px] leading-6 font-semibold text-[#202020]">
        {value}
      </span>
      <span className="text-[13px] leading-5 text-[#737373]">{label}</span>
    </div>
  )
}

/** Matches the loaded layout so the page does not jump when data lands. */
function ProfileSkeleton() {
  return (
    <main className="w-full bg-white pt-[72px]">
      <div className="h-[180px] w-full bg-[#f1f1ef] sm:h-[220px]" />
      <div className="mx-auto w-full max-w-[1100px] px-6 lg:px-8">
        <div className="-mt-14 flex flex-col gap-4 sm:-mt-16 sm:flex-row sm:items-end">
          <Skeleton className="size-28 rounded-full ring-4 ring-white sm:size-32" />
          <div className="flex-1 space-y-2 pb-2">
            <Skeleton className="h-6 w-52" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="mt-6 flex gap-8">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="space-y-1.5">
              <Skeleton className="h-5 w-10" />
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
        </div>
        <div className="mt-8 border-t pt-8">
          <div className="mx-auto max-w-[680px] space-y-6">
            <Skeleton className="h-[320px] w-full rounded-2xl" />
            <Skeleton className="h-[320px] w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </main>
  )
}

const TABS = ["Properties", "About", "Reviews"] as const

/** Public agent page, laid out like a social profile: banner, identity, feed. */
export function AgentProfile({ handle }: { handle: string }) {
  const session = useSession()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<(typeof TABS)[number]>("Properties")

  const query = useQuery({
    queryKey: ["agent-profile", handle],
    queryFn: ({ signal }) =>
      apiRequest(`/profiles/agents/${handle}`, {
        method: "GET",
        schema: agentProfileDetailSchema,
        signal,
      }),
  })

  // Follow targets the user id, which the profile response carries; the handle
  // in the URL may be a username.
  const agentUserId = query.data?.userId ?? ""

  const follow = useMutation({
    mutationFn: (following: boolean) =>
      following ? unfollowProfile(agentUserId) : followProfile(agentUserId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["agent-profile", handle],
      })
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  })

  if (query.isPending) return <ProfileSkeleton />

  if (query.isError || !query.data) {
    return (
      <main className="grid min-h-[60vh] place-items-center px-6">
        <div className="flex max-w-[380px] flex-col items-center gap-2 text-center">
          <h1 className="text-[20px] font-[550] text-[#202020]">
            Agent not found
          </h1>
          <p className="text-[15px] leading-6 text-[#636363]">
            This profile may have been removed, or the link may be wrong.
          </p>
          <Link
            href="/agents"
            className="mt-2 inline-flex h-11 items-center rounded-full bg-[#171717] px-5 text-[15px] font-medium text-white hover:bg-black"
          >
            Browse agents
          </Link>
        </div>
      </main>
    )
  }

  const agent = query.data
  const joined = new Date(agent.joinedAt).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  })

  return (
    <main className="w-full bg-white pt-[72px]">
      {/* Banner: a plain brand wash rather than a stock photo standing in for
          something the agent never uploaded. */}
      <div className="h-[180px] w-full bg-gradient-to-br from-[#0b5d34] via-[#137547] to-[#1f8a54] sm:h-[220px]" />

      <div className="mx-auto w-full max-w-[1100px] px-6 lg:px-8">
        <div className="-mt-14 flex flex-col gap-4 sm:-mt-16 sm:flex-row sm:items-end">
          <span className="grid size-28 shrink-0 place-items-center overflow-hidden rounded-full bg-[#efece9] text-3xl font-semibold text-[#5b524c] ring-4 ring-white sm:size-32">
            {agent.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={agent.image} alt="" className="size-full object-cover" />
            ) : (
              agent.name.slice(0, 1).toUpperCase()
            )}
          </span>

          <div className="flex min-w-0 flex-1 flex-wrap items-end justify-between gap-4 pb-1">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[26px] leading-8 font-semibold tracking-[-.02em] text-[#202020]">
                  {agent.name}
                </h1>
                {agent.verified ? (
                  <BadgeCheck
                    className="size-5 text-emerald-700"
                    aria-label="Verified agent"
                  />
                ) : null}
                {agent.availabilityStatus === "AVAILABLE" ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-800">
                    Available
                  </span>
                ) : null}
              </div>
              {agent.headline ? (
                <p className="mt-1 text-[15px] leading-6 text-[#636363]">
                  {agent.headline}
                </p>
              ) : null}
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
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Stat value={agent.listings.length} label="Properties" />
          <Stat value={agent.followerCount} label="Followers" />
          <Stat value={agent.reviewCount} label="Reviews" />
          <div className="flex items-center gap-1.5 self-end pb-0.5">
            <Stars rating={agent.averageRating} />
            <span className="text-[13px] text-[#737373]">
              {agent.averageRating.toFixed(1)}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[#737373]">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5" />
            Joined {joined}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="size-3.5" />
            Bhumiraj appointed agent
          </span>
        </div>

        <div
          role="tablist"
          aria-label="Profile sections"
          className="mt-7 flex gap-1 border-b"
        >
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={tab === item}
              onClick={() => setTab(item)}
              className={`relative h-11 px-4 text-[15px] font-medium transition-colors ${
                tab === item
                  ? "text-[#202020] after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-[#171717]"
                  : "text-[#737373] hover:text-[#202020]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="py-8">
          {tab === "Properties" ? (
            <div className="mx-auto max-w-[680px]">
              <AgentListingFeed
                agentUserId={agent.userId}
                emptyMessage={`${agent.name} has no published properties yet.`}
              />
            </div>
          ) : null}

          {tab === "About" ? (
            <div className="mx-auto max-w-[680px] space-y-5">
              {agent.about ? (
                <p className="text-[15px] leading-7 text-[#3f3f3f]">
                  {agent.about}
                </p>
              ) : (
                <p className="rounded-2xl bg-[#f7f7f6] px-6 py-10 text-center text-sm text-[#636363]">
                  {agent.name} has not written a bio yet.
                </p>
              )}
              <dl className="grid gap-4 rounded-2xl bg-[#f7f7f6] p-5 sm:grid-cols-2">
                <div>
                  <dt className="text-[13px] text-[#737373]">Status</dt>
                  <dd className="mt-0.5 text-[15px] font-medium text-[#202020]">
                    {agent.status === "ACTIVE" ? "Active" : agent.status}
                  </dd>
                </div>
                <div>
                  <dt className="text-[13px] text-[#737373]">Availability</dt>
                  <dd className="mt-0.5 flex items-center gap-1.5 text-[15px] font-medium text-[#202020]">
                    <MapPin className="size-4 text-[#737373]" />
                    {agent.availabilityStatus === "AVAILABLE"
                      ? "Taking new properties"
                      : "Not taking new properties"}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}

          {tab === "Reviews" ? (
            <div className="mx-auto max-w-[680px]">
              {agent.reviews.length === 0 ? (
                <p className="rounded-2xl bg-[#f7f7f6] px-6 py-10 text-center text-sm text-[#636363]">
                  No reviews yet.
                </p>
              ) : (
                <ul className="space-y-4">
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
              )}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  )
}
