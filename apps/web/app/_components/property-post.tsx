"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import {
  BadgeCheck,
  Building2,
  LandPlot,
  MapPin,
  Phone,
  Ruler,
  Share2,
  Tag,
} from "lucide-react"
import {
  CardFrameAction,
  CardFrameDescription,
  CardFrameTitle,
} from "@/components/ui/card"
import { PropertyCardCarousel } from "./residence-card"
import { SaveButton } from "./save-button"
import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel } from "@/components/ui/frame"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type PropertyPostData = {
  slug: string
  title: string
  description: string
  images: string[]
  agent: { name: string; image?: string | null; verified?: boolean }
  publishedAt?: string | null
  reference?: string | undefined
  price?: string | undefined
  location: string
  propertyType?: string | undefined
  area?: string | undefined
  category?: string | undefined
  badge?: string | undefined
  listingId?: string | undefined
  latitude?: number | undefined
  longitude?: number | undefined
}

/** "12 hours ago" style stamp; falls back to nothing when the date is absent. */
function relativeTime(value?: string | null): string | null {
  if (!value) return null
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return null

  const seconds = Math.round((Date.now() - then) / 1000)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ]
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
  for (const [unit, size] of units) {
    if (seconds >= size) return formatter.format(-Math.floor(seconds / size), unit)
  }
  return "just now"
}

function DetailField({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Tag
  label: string
  value: string
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-[#8a8a8a]" strokeWidth={1.7} />
      <div className="min-w-0">
        <div className="text-[12px] leading-normal text-[#8a8a8a]">{label}</div>
        <div className="truncate text-[14px] leading-normal font-medium text-[#1d1919]">
          {value}
        </div>
      </div>
    </div>
  )
}

/**
 * A listing presented as a social post: framed header, description, gallery and
 * a details grid, matching the reviewed card-frame layout.
 */
export function PropertyPost({ post }: { post: PropertyPostData }) {
  const [expanded, setExpanded] = useState(false)
  const [clamped, setClamped] = useState(false)
  const descriptionRef = useRef<HTMLDivElement>(null)
  const href = `/properties/${post.slug}`
  const posted = relativeTime(post.publishedAt)

  // Only offer "See more" when the text is genuinely cut off. Re-measured on
  // resize because the clamp depends on the column width, not the character count.
  useEffect(() => {
    const node = descriptionRef.current
    if (!node) return

    const measure = () => {
      if (expanded) return
      setClamped(node.scrollHeight - node.clientHeight > 1)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [expanded, post.description])

  const details = [
    post.reference
      ? { icon: Tag, label: "Property ID", value: post.reference }
      : null,
    post.price ? { icon: Tag, label: "Price", value: post.price } : null,
    { icon: MapPin, label: "Location", value: post.location },
    post.propertyType
      ? { icon: Building2, label: "Type", value: post.propertyType }
      : null,
    post.area ? { icon: Ruler, label: "Size", value: post.area } : null,
    post.category
      ? { icon: LandPlot, label: "Category", value: post.category }
      : null,
  ].filter((field) => field !== null)

  return (
    <Frame className="w-full">
      <FrameHeader>
        <div className="flex items-center justify-between w-full">          
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[#efece9] text-[14px] font-semibold text-[#5b524c]">
              {post.agent.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.agent.image}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                post.agent.name.slice(0, 1).toUpperCase()
              )}
            </span>
            <div className="min-w-0">
              <CardFrameTitle className="flex items-center gap-1 truncate text-[15px]">
                {post.agent.name}
                {post.agent.verified ? (
                  <BadgeCheck className="size-4 shrink-0 text-emerald-700" />
                ) : null}
              </CardFrameTitle>
              <CardFrameDescription className="truncate text-[13px]">
                Property Agent
              </CardFrameDescription>
            </div>
          </div>
  
          <CardFrameAction className="flex gap-1">
            <SaveButton
              listingId={post.listingId}
              className="inline-flex size-9 items-center justify-center rounded-md bg-secondary text-secondary-foreground transition-colors hover:bg-secondary/80"
              iconClassName="size-[18px]"
            />
            <Button
              type="button"
              size={"icon"}
              aria-label="Share property"
              onClick={() => window.open(href, "_blank")}
              variant={"secondary"}
            >
              <Share2 className="size-4" strokeWidth={1.8} />
            </Button>
            <Link
              href={href}
              className={cn(buttonVariants({ variant: "default" }))}
            >
              <Phone className="size-4" strokeWidth={1.8} />
              Contact Agent
            </Link>
          </CardFrameAction>
        </div>

        <div className="mt-2 flex items-baseline justify-between gap-4">
          <Link
            href={href}
            className="truncate text-[16px] leading-snug font-semibold text-[#1d1919] hover:underline"
          >
            {post.title}
          </Link>
          {posted ? (
            <span className="shrink-0 text-[12px] text-[#8a8a8a]">{posted}</span>
          ) : null}
        </div>

        <FrameDescription
          ref={descriptionRef}
          className={`mt-1 leading-6 ${expanded ? "" : "line-clamp-2"}`}
        >
          {post.description}
        </FrameDescription>
        {clamped || expanded ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="mt-1 self-start text-[14px] font-semibold text-[#1d1919] hover:underline"
          >
            {expanded ? "See less" : "See more"}
          </button>
        ) : null}
      </FrameHeader>

      <FramePanel className="overflow-hidden p-0">
        <PropertyCardCarousel
          href={href}
          images={post.images}
          fallbackImage={post.images[0] ?? "/images/featured-1.webp"}
          alt={post.title}
          aspectRatio="16 / 10"
          className="bg-[#f1f1ef]"
          topLeft={
            post.badge ? (
              <span className="mt-3.5 ml-3.5 inline-flex h-7 items-center rounded-md bg-black/55 px-2.5 text-[12px] font-medium text-white backdrop-blur-md">
                {post.badge}
              </span>
            ) : null
          }
        />
      </FramePanel>

      <FrameFooter className="flex w-full gap-2 px-5 py-4">
          <div className="grid w-full grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            {details.map((field) => (
              <DetailField
                key={field.label}
                icon={field.icon}
                label={field.label}
                value={field.value}
              />
            ))}
          </div>
      </FrameFooter>
    </Frame>
  )
}
