"use client"

import type React from "react"
import type { ReactNode } from "react"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import {
  BadgeCheck,
  Building2,
  Gavel,
  LandPlot,
  MapPin,
  Phone,
  Ruler,
  Tag,
} from "lucide-react"
import {
  CardFrameAction,
  CardFrameDescription,
  CardFrameTitle,
} from "@/components/ui/card"
import { PropertyCardCarousel } from "./property-card-carousel"
import { SaveButton } from "./save-button"
import { ShareMenu } from "./share-menu"
import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel } from "@/components/ui/frame"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type PropertyPostData = {
  slug: string
  title: string
  description: string
  images: string[]
  agent: {
    id?: string | undefined
    name: string
    image?: string | null
    verified?: boolean
  }
  publishedAt?: string | null
  reference?: string | undefined
  price?: string | undefined
  location: string
  propertyType?: string | undefined
  area?: string | undefined
  category?: string | undefined
  badge?: string | undefined
  listingId?: string | undefined
  /** Whether the signed-in viewer already saved this listing. */
  saved?: boolean | undefined
  /** Set when the listing is an auction: the post is identical bar its action. */
  auctionId?: string | undefined
  latitude?: number | undefined
  longitude?: number | undefined
}

/** SCREAMING_SNAKE enums read as prose in the card. */
function humanise(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
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
/**
 * Mirrors the post's real structure — avatar row, media, spec grid — so the
 * layout does not jump when the data lands.
 */
function Bar({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-black/[.07]", className)}
      aria-hidden="true"
      {...props}
    />
  )
}

export function PropertyPostSkeleton() {
  return (
    <Frame className="w-full">
      <FrameHeader>
        <div className="flex w-full items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Bar className="size-10 shrink-0 rounded-full" />
            <div className="space-y-2">
              <Bar className="h-3.5 w-32" />
              <Bar className="h-3 w-20" />
            </div>
          </div>
          <div className="hidden shrink-0 gap-1.5 sm:flex">
            <Bar className="size-9" />
            <Bar className="size-9" />
            <Bar className="h-9 w-32" />
          </div>
        </div>
      </FrameHeader>

      <FramePanel className="space-y-2.5">
        <Bar className="h-4 w-2/5" />
        <Bar className="h-3.5 w-full" />
        <Bar className="h-3.5 w-11/12" />
        <Bar className="h-3.5 w-3/5" />
      </FramePanel>

      <FramePanel className="overflow-hidden p-0">
        <Bar className="w-full rounded-none" style={{ aspectRatio: "16 / 10" }} />
      </FramePanel>

      <FrameFooter>
        <div className="grid w-full grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="space-y-2">
              <Bar className="h-2.5 w-16" />
              <Bar className="h-3.5 w-24" />
            </div>
          ))}
        </div>
      </FrameFooter>
    </Frame>
  )
}

function AgentLink({
  agentId,
  children,
}: {
  agentId?: string | undefined
  children: ReactNode
}) {
  if (!agentId) return <>{children}</>
  return <Link href={`/agents/${agentId}`}>{children}</Link>
}

export function PropertyPost({
  post,
  showAgent = true,
  preview = false,
}: {
  post: PropertyPostData
  /** Off on an agent's own profile, where every post has the same byline. */
  showAgent?: boolean
  /**
   * Shows the post exactly as it will publish, with every action and link
   * inert — the listing behind them does not exist yet.
   */
  preview?: boolean
}) {
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
      ? { icon: Building2, label: "Type", value: humanise(post.propertyType) }
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
          <div className={showAgent ? "flex min-w-0 items-center gap-3" : "hidden"}>
            <AgentLink agentId={post.agent.id}>
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
            </AgentLink>
            <div className="min-w-0">
              <AgentLink agentId={post.agent.id}>
                <CardFrameTitle className="flex items-center gap-1 truncate text-[15px] hover:underline">
                  {post.agent.name}
                  {post.agent.verified ? (
                    <BadgeCheck className="size-4 shrink-0 text-emerald-700" />
                  ) : null}
                </CardFrameTitle>
              </AgentLink>
              <CardFrameDescription className="truncate text-[13px]">
                Property Agent
              </CardFrameDescription>
            </div>
          </div>
  
{preview ? null : (
          <CardFrameAction className="flex gap-1">
            <SaveButton
              listingId={post.listingId}
              initialSaved={post.saved ?? false}
              className="inline-flex size-9 items-center justify-center rounded-md bg-secondary text-secondary-foreground transition-colors hover:bg-secondary/80"
              iconClassName="size-[18px]"
            />
            <ShareMenu
              iconOnly
              details={{
                title: post.title,
                text: post.price
                  ? `${post.price} · ${post.location}`
                  : post.location,
                path: href,
              }}
              className="inline-flex size-9 items-center justify-center rounded-md bg-secondary text-secondary-foreground transition-colors hover:bg-secondary/80"
            />
            {post.auctionId ? (
              <Link
                href={`/auctions/${post.auctionId}/enroll`}
                className={cn(buttonVariants({ variant: "default" }))}
              >
                <Gavel className="size-4" strokeWidth={1.8} />
                Enroll
              </Link>
            ) : (
              <Link
                href={href}
                className={cn(buttonVariants({ variant: "default" }))}
              >
                <Phone className="size-4" strokeWidth={1.8} />
                Contact Agent
              </Link>
            )}
          </CardFrameAction>
          )}
        </div>

        <div className="mt-2 flex items-baseline justify-between gap-4">
          {preview ? (
            <span className="truncate text-[16px] leading-snug font-semibold text-[#1d1919]">
              {post.title}
            </span>
          ) : (
            <Link
              href={href}
              className="truncate text-[16px] leading-snug font-semibold text-[#1d1919] hover:underline"
            >
              {post.title}
            </Link>
          )}
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
          preview={preview}
          href={href}
          images={post.images}
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
