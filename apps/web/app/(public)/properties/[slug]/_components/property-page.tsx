"use client"

import Link from "next/link"
import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { PublicHeader } from "@/app/_components/public-header"
import { SiteFooter } from "@/app/_components/site-footer"
import { queryKeys } from "@/shared/query/query-keys"
import {
  getListingDetail,
  recordListingView,
} from "@/features/listings/api/listing-detail-api"
import { StayPage } from "./stay-page"

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto grid min-h-[70vh] max-w-site place-items-center px-6 pt-[72px] lg:px-8">
        {children}
      </main>
      <SiteFooter />
    </>
  )
}

/**
 * Fetches one published listing and renders it in the property layout. The
 * layout itself is presentational, so it can be rendered from any source.
 */
export function PropertyPage({ slug }: { slug: string }) {
  const query = useQuery({
    queryKey: queryKeys.listings.detail(slug),
    queryFn: ({ signal }) => getListingDetail(slug, signal),
    staleTime: 60_000,
    retry: false,
  })

  const listingId = query.data?.id
  useEffect(() => {
    if (!listingId) return
    void recordListingView(listingId).catch(() => undefined)
  }, [listingId])

  if (query.isPending) {
    return (
      <Shell>
        <p className="text-[15px] text-[#636363]">Loading property…</p>
      </Shell>
    )
  }

  if (query.isError || !query.data) {
    return (
      <Shell>
        <div className="flex max-w-[420px] flex-col items-center gap-3 text-center">
          <h1 className="text-[22px] leading-7 font-[550] text-[#202020]">
            This property is not available
          </h1>
          <p className="text-[15px] leading-6 text-[#636363]">
            It may have been withdrawn, or the link may be wrong.
          </p>
          <Link
            href="/search?type=SALE"
            className="mt-2 inline-flex h-11 items-center rounded-full bg-[#171717] px-5 text-[15px] font-medium text-white hover:bg-black"
          >
            Browse properties
          </Link>
        </div>
      </Shell>
    )
  }

  return <StayPage listing={query.data} />
}
