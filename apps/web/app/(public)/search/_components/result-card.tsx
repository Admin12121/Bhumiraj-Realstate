"use client"

import Link from "next/link"
import { Crown, Sparkles } from "lucide-react"
import { PropertyCardCarousel } from "@/app/_components/residence-card"
import { SaveButton } from "@/app/_components/save-button"
import { Frame, FrameFooter, FramePanel } from "@/components/ui/frame"

export type SearchResult = {
  listingId?: string | undefined
  slug: string
  title: string
  city: string
  image: string
  images?: string[]
  bedrooms?: number | undefined
  bathrooms?: number | undefined
  area?: string | undefined
  propertyType?: string | undefined
  price?: string | undefined
  originalPrice?: string | undefined
  priceLabel?: string
}

type Cell = { label: string; value: string }

/**
 * Highest-value facts first, skipping anything the listing does not carry, so a
 * land plot and a house both fill the grid without leaving holes.
 */
function dataCells(result: SearchResult): Cell[] {
  const byPriority: (Cell | null)[] = [
    result.bedrooms != null
      ? { label: "Bedrooms", value: String(result.bedrooms) }
      : null,
    result.bathrooms != null
      ? { label: "Bathrooms", value: String(result.bathrooms) }
      : null,
    result.area ? { label: "Area", value: result.area } : null,
    result.propertyType ? { label: "Type", value: result.propertyType } : null,
  ]

  // Price always takes the final slot; the rest fill the first three.
  const filled = byPriority.filter((cell) => cell !== null).slice(0, 3)
  if (result.price) {
    filled.push({
      label: result.priceLabel ?? "Guide price",
      value: result.price,
    })
  }
  return filled
}

/** Skeleton twin of ResultCard, matching its box so swaps do not jump. */
export function ResultCardSkeleton() {
  return (
    <article className="min-w-0 pb-6">
      <Frame className="w-full">
        <FramePanel className="overflow-hidden p-0">
          <div className="aspect-[4/3.25] w-full animate-pulse bg-[#f1f1ef]" />
        </FramePanel>
        <FrameFooter className="flex flex-col gap-3 px-4 py-4">
          <div className="h-4 w-2/3 animate-pulse rounded bg-[#f1f1ef]" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-[#f1f1ef]" />
          <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-3">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex flex-col gap-1.5">
                <div className="h-2.5 w-12 animate-pulse rounded bg-[#f1f1ef]" />
                <div className="h-3.5 w-16 animate-pulse rounded bg-[#f1f1ef]" />
              </div>
            ))}
          </div>
        </FrameFooter>
      </Frame>
    </article>
  )
}

/** Search result card: media, title, location, then a priority-filled data grid. */
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
  const tier = index % 5 === 0 ? "Iconic" : "Luxury"
  const href = `/properties/${result.slug}`
  const cells = dataCells(result)

  return (
    <article
      className="min-w-0 pb-6"
      onMouseEnter={() => onHoverChange?.(result.slug)}
      onMouseLeave={() => onHoverChange?.(null)}
    >
      {/* Soft ring with an offset so the pairing with the map marker reads
          without the hard border of a full-weight ring. */}
      <Frame
        className={`w-full transition-all duration-200 ${
          highlighted
            ? "ring-1 ring-black/20 ring-offset-2 ring-offset-white"
            : "ring-0 ring-offset-0"
        }`}
      >
        <FramePanel className="overflow-hidden p-0">
          <PropertyCardCarousel
            href={href}
            images={result.images ?? [result.image]}
            fallbackImage={result.image}
            alt={result.title}
            aspectRatio="4 / 3.25"
            className="bg-[#f1f1ef]"
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
              <SaveButton
                listingId={result.listingId}
                className="mt-3.5 mr-3.5 grid size-8 place-items-center rounded-full bg-black/20 text-white backdrop-blur-md transition hover:bg-black/30"
                iconClassName="size-5"
              />
            }
          />
        </FramePanel>

        <FrameFooter className="flex flex-col gap-1 px-4 py-4">
          <Link
            href={href}
            title={result.title}
            className="line-clamp-1 text-[16px] leading-normal font-medium tracking-[-0.015em] text-[#1d1919] hover:underline"
          >
            {result.title}
          </Link>
          <p
            title={result.city}
            className="truncate text-[13px] leading-normal text-[#737373]"
          >
            {result.city}
          </p>

          {cells.length > 0 ? (
            <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2.5">
              {cells.map((cell) => (
                <div key={cell.label} className="min-w-0">
                  <dt className="text-[11px] leading-normal text-[#8a8a8a]">
                    {cell.label}
                  </dt>
                  <dd className="truncate text-[14px] leading-normal font-medium text-[#1d1919]">
                    {cell.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </FrameFooter>
      </Frame>
    </article>
  )
}
