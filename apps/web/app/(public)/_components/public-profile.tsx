"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  LoaderCircle,
  MessageCircle,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@real-estate/auth/client";
import { queryKeys } from "@/shared/query/query-keys";
import { useListingFeed } from "@/features/listings/queries/use-listing-feed";
import { PropertyCard } from "@/app/_components/property-card";
import {
  followProfile,
  getPublicProfile,
  startConversation,
  unfollowProfile,
} from "@/features/profiles/api/profiles-api";

export function PublicProfile({ id }: { id: string }) {
  const router = useRouter();
  const session = useSession();
  const queryClient = useQueryClient();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const profile = useQuery({
    queryKey: queryKeys.profiles.detail(id),
    queryFn: ({ signal }) => getPublicProfile(id, signal),
    staleTime: 60_000,
  });
  const listings = useListingFeed({ agentId: id, sort: "newest" });
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = listings;

  const follow = useMutation({
    mutationFn: (nextFollowed: boolean) =>
      nextFollowed ? followProfile(id) : unfollowProfile(id),
    onMutate: async (nextFollowed) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.profiles.detail(id) });
      const previous = queryClient.getQueryData(queryKeys.profiles.detail(id));
      queryClient.setQueryData(
        queryKeys.profiles.detail(id),
        (current: typeof profile.data) =>
          current
            ? {
                ...current,
                followedByMe: nextFollowed,
                stats: {
                  ...current.stats,
                  followers: Math.max(
                    0,
                    current.stats.followers + (nextFollowed ? 1 : -1),
                  ),
                },
              }
            : current,
      );
      return { previous };
    },
    onError: (error: Error, _nextFollowed, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.profiles.detail(id), context.previous);
      }
      toast.error(error.message);
    },
    onSuccess: (result) => {
      queryClient.setQueryData(
        queryKeys.profiles.detail(id),
        (current: typeof profile.data) =>
          current
            ? {
                ...current,
                followedByMe: result.followed,
                stats: { ...current.stats, followers: result.followerCount },
              }
            : current,
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profiles.detail(id) });
    },
  });

  const message = useMutation({
    mutationFn: (body: string) =>
      startConversation({ participantId: id, message: body }),
    onSuccess: (conversation) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
      router.push(`/account/messages?conversation=${conversation.id}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

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

  const publishedListings = useMemo(
    () => listings.data?.pages.flatMap((page) => page.items) ?? [],
    [listings.data],
  );

  function requireSession() {
    if (session.data) return true;
    router.push(`/sign-in?callbackURL=${encodeURIComponent(`/users/${id}`)}`);
    return false;
  }

  function toggleFollow() {
    if (!requireSession() || !profile.data || profile.data.isSelf) return;
    follow.mutate(!profile.data.followedByMe);
  }

  function beginMessage() {
    if (!requireSession() || profile.data?.isSelf) return;
    const body = globalThis.prompt(
      "Write your first message",
      "Hello, I would like to discuss one of your properties.",
    );
    if (body?.trim()) message.mutate(body.trim());
  }

  if (profile.isLoading) {
    return <div className="grid min-h-screen place-items-center text-sm text-slate-500">Loading profileâ€¦</div>;
  }
  if (profile.isError || !profile.data) {
    return <div className="grid min-h-screen place-items-center text-sm text-slate-500">Profile unavailable.</div>;
  }

  const person = profile.data;
  return (
    <main id="main-content" className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-5 py-8">
        <Link href="/" className="text-sm font-semibold text-emerald-700">
          â† Back to marketplace
        </Link>

        <section className="surface mt-5 overflow-hidden rounded-[26px]">
          <div className="relative h-48 bg-gradient-to-r from-emerald-900 to-emerald-500">
            {person.coverImage && (
              <Image
                src={person.coverImage}
                fill
                alt=""
                priority
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 1024px"
              />
            )}
          </div>
          <div className="px-6 pb-7">
            <div className="-mt-12 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div className="flex items-end gap-4">
                <div className="relative size-24 overflow-hidden rounded-full border-4 border-white bg-emerald-50 shadow-sm">
                  {person.image ? (
                    <Image
                      src={person.image}
                      fill
                      alt={`${person.name} profile`}
                      className="object-cover"
                      sizes="96px"
                    />
                  ) : (
                    <span className="grid h-full place-items-center text-3xl font-bold text-emerald-700">
                      {person.name[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="pb-1">
                  <h1 className="flex items-center gap-2 text-2xl font-bold">
                    {person.name}
                    {person.verified && (
                      <CheckCircle2 className="size-5 fill-blue-500 text-white" aria-label="Verified" />
                    )}
                  </h1>
                  <p className="text-sm text-slate-500">
                    @{person.username || person.id.slice(0, 8)} Â· {person.role}
                  </p>
                </div>
              </div>

              {!person.isSelf && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={toggleFollow}
                    disabled={follow.isPending}
                    aria-pressed={person.followedByMe}
                    className={
                      person.followedByMe
                        ? "flex items-center gap-2 rounded-xl border border-emerald-700 px-4 py-2.5 text-sm font-semibold text-emerald-800"
                        : "brand-button flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
                    }
                  >
                    {follow.isPending ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : person.followedByMe ? (
                      <UserCheck className="size-4" />
                    ) : (
                      <UserPlus className="size-4" />
                    )}
                    {person.followedByMe ? "Following" : "Follow"}
                  </button>
                  <button
                    type="button"
                    onClick={beginMessage}
                    disabled={message.isPending}
                    className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold"
                  >
                    <MessageCircle className="size-4" />
                    Message
                  </button>
                </div>
              )}
            </div>

            <p className="mt-6 max-w-2xl text-sm leading-7 text-slate-600">
              {person.bio || "Property professional on Bhumiraj Estates."}
            </p>
            <div className="mt-5 flex flex-wrap gap-6 text-sm">
              <span><b>{person.stats.listings}</b> listings</span>
              <span><b>{person.stats.followers}</b> followers</span>
              <span><b>{person.stats.following}</b> following</span>
              <span className="flex items-center gap-2 text-slate-500">
                <CalendarDays className="size-4" />
                Joined {new Date(person.joinedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                })}
              </span>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Published properties</h2>
              <p className="mt-1 text-sm text-slate-500">
                Latest verified marketplace posts from {person.name}.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            {publishedListings.map((listing) => (
              <PropertyCard key={listing.id} listing={listing} />
            ))}
            {listings.isLoading && (
              <div className="surface rounded-2xl p-8 text-center text-sm text-slate-500">
                Loading propertiesâ€¦
              </div>
            )}
            {!listings.isLoading && publishedListings.length === 0 && (
              <div className="surface rounded-2xl p-10 text-center text-sm text-slate-500">
                No published properties yet.
              </div>
            )}
            {listings.isFetchingNextPage && (
              <div className="surface rounded-2xl p-6 text-center text-sm text-slate-500">
                Loading more propertiesâ€¦
              </div>
            )}
            <div ref={loadMoreRef} className="h-1" aria-hidden="true" />
          </div>
        </section>
      </div>
    </main>
  );
}
