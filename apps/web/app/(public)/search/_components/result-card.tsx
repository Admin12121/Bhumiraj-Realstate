"use client"

import Link from "next/link"
import { useState } from "react"
import { Crown, Heart, Sparkles } from "lucide-react"
import { PropertyCardCarousel } from "@/app/_components/residence-card"

export type SearchResult = {
  slug: string
  title: string
  city: string
  image: string
  images?: string[]
  bedrooms?: number | undefined
  bathrooms?: number | undefined
  price?: string | undefined
  originalPrice?: string | undefined
  priceLabel?: string
}

/** The reference's search result card: taller media, tier pill, stats row. */
export function ResultCard({
  result,
  index,
  highlighted = false,
  onHoverChange,
}: {
  result: SearchResult
  index: number
  highlighted?: boolean
  onHoverChange?: (slug: string | null) => void
}) {
  const [saved, setSaved] = useState(false)
  const tier = index % 5 === 0 ? "Iconic" : "Luxury"
  const href = `/properties/${result.slug}`

  return (
    <article
      className="min-w-0 pb-8"
      onMouseEnter={() => onHoverChange?.(result.slug)}
      onMouseLeave={() => onHoverChange?.(null)}
    >
      {/* The ring sits on an inner wrapper so it never reaches into the row
          below — the article's own bottom padding is the grid's row gutter. */}
      <div
        className={
          highlighted
            ? "rounded-[12px] ring-2 ring-[#171717] ring-offset-4 ring-offset-white transition"
            : "rounded-[12px] transition"
        }
      >
      <PropertyCardCarousel
        href={href}
        images={result.images ?? [result.image]}
        fallbackImage={result.image}
        alt={result.title}
        aspectRatio="4 / 3.25"
        className="rounded-lg bg-[#f1f1ef]"
        imageClassName="group-hover/media:scale-[1.01]"
        topLeft={
          <div className="mt-3.5 ml-3.5 flex h-7 items-center gap-1.5 rounded-full border border-white/20 bg-black/25 px-2.5 text-white backdrop-blur-md">
            {tier === "Iconic" ? (
              <Crown className="size-3.5 shrink-0" strokeWidth={1.8} />
            ) : (
              <Sparkles className="size-3.5 shrink-0" strokeWidth={1.8} />
            )}
            <span className="text-[13px] leading-none font-medium whitespace-nowrap">
              {tier}
            </span>
          </div>
        }
        topRight={
          <button
            type="button"
            aria-label={saved ? "Remove from saved homes" : "Save home"}
            aria-pressed={saved}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              setSaved((value) => !value)
            }}
            className="mt-3.5 mr-3.5 grid size-8 place-items-center rounded-full bg-black/20 text-white backdrop-blur-md transition hover:bg-black/30"
          >
            <Heart
              className={`size-5 ${saved ? "fill-white" : "fill-transparent"}`}
              strokeWidth={1.7}
            />
          </button>
        }
      />

      <Link href={href} className="block text-[#1d1919]">
        <div className="flex w-full flex-col px-0 pt-4 pb-5">
          <div
            title={result.title}
            className="mb-1 line-clamp-1 text-[18px] leading-normal font-medium tracking-[-0.015em]"
          >
            {result.title}
          </div>
          <div
            title={result.city}
            className="text-[13px] leading-normal font-normal text-[#737373]"
          >
            {result.city}
          </div>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 gap-4">
            {result.bedrooms != null && (
              <div>
                <div className="text-[15px] leading-normal font-normal">
                  {result.bedrooms}
                </div>
                <div className="text-[11px] leading-normal font-normal text-[#737373]">
                  Bedrooms
                </div>
              </div>
            )}
            {result.bathrooms != null && (
              <div>
                <div className="text-[15px] leading-normal font-normal">
                  {result.bathrooms}
                </div>
                <div className="text-[11px] leading-normal font-normal text-[#737373]">
                  Bathrooms
                </div>
              </div>
            )}
          </div>

          {result.price && (
            <div className="flex min-w-0 flex-col items-end text-right">
              <div className="text-[15px] leading-normal font-medium break-words">
                {result.originalPrice && (
                  <span className="mr-1.5 text-[13px] font-normal text-[#737373] line-through">
                    {result.originalPrice}
                  </span>
                )}
                {result.price}
              </div>
              <div className="text-[11px] leading-normal font-normal text-[#737373]">
                {result.priceLabel ?? "Guide price"}
              </div>
            </div>
          )}
        </div>
      </Link>
      </div>
    </article>
  )
}
