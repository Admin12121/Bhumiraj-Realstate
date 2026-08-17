"use client"

import { useState } from "react"
import {
  BadgeCheck,
  ChevronRight,
  FileCheck2,
  Ruler,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { Home } from "lucide-react"
import { MapSurface } from "@/app/_components/property-map"
import { SaveButton } from "@/app/_components/save-button"
import { ShareMenu } from "@/app/_components/share-menu"

const sectionClass = "flex flex-col gap-6 py-8 lg:gap-8 lg:py-10"
const divider = (
  <div aria-hidden="true" className="h-px w-full bg-black/[.08]" />
)





export function StaySections({
  title,
  location,
  slug,
  description,
  detail,
  overview,
  nearby,
  coordinates,
  coverImage,
  listingId,
}: {
  title: string
  location: string
  slug: string
  description: string
  detail: { icon: typeof Home; label: string; value: string }[]
  overview: { label: string; value: string }[]
  nearby: { label: string; distance: string }[]
  coordinates?: { latitude: number; longitude: number } | undefined
  coverImage?: string | undefined
  listingId?: string | undefined
}) {
  const [expandedAbout, setExpandedAbout] = useState(false)

  return (
    <div>
      <section id="section-summary" className={`${sectionClass} pt-0`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2.5">
            <h2 className="text-[16px] leading-5 font-normal text-[#636363]">
              Home in {location}
            </h2>
            {/* Chips sit with the title so the heading block reads as one unit. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-[24px] leading-7 font-[550] tracking-[-.01em] text-[#202020]">
                {title}
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f7f7f6] px-3 py-1.5 text-[13px] font-medium text-[#202020]">
                <Sparkles className="size-3.5 text-[#636363]" strokeWidth={1.8} />
                Luxury
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f7f7f6] px-3 py-1.5 text-[13px] font-medium text-[#202020]">
                <BadgeCheck
                  className="size-3.5 text-emerald-700"
                  strokeWidth={1.8}
                />
                Verified by Bhumiraj
              </span>
            </div>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <SaveButton
              listingId={listingId}
              className="grid size-10 place-items-center rounded-full bg-[#f0f0f0] text-[#202020] hover:bg-[#eaeaea]"
            />
            <ShareMenu
              iconOnly
              details={{
                title,
                text: `Property in ${location}, Nepal`,
                path: `/properties/${slug}`,
              }}
              className="grid size-10 place-items-center rounded-full bg-[#f0f0f0] text-[#202020] hover:bg-[#eaeaea]"
            />
          </div>
        </div>

        {/* The description leads here; the facts live in Property detail below. */}
        <div id="section-about" className="text-[16px] leading-6 text-[#636363]">
          <p className={expandedAbout ? "" : "line-clamp-3"}>{description}</p>
          {description.length > 220 ? (
            <button
              type="button"
              onClick={() => setExpandedAbout((value) => !value)}
              className="mt-2 text-[16px] font-[550] text-[#202020] underline"
            >
              {expandedAbout ? "Show less" : "Show more"}
            </button>
          ) : null}
        </div>
      </section>

      {divider}

      <section id="section-amenities" className={sectionClass}>
        <div className="flex flex-col gap-6">
          <h2 className="text-[24px] leading-7 font-[550] tracking-[-.01em]">
            Property detail
          </h2>
        </div>

        <dl className="grid grid-cols-1 gap-x-10 gap-y-5 rounded-2xl bg-[#f7f7f6] p-6 sm:grid-cols-2">
          {detail.map((field) => {
            const Icon = field.icon
            return (
              <div key={field.label} className="flex min-w-0 items-start gap-3">
                <Icon className="mt-0.5 size-5 shrink-0 text-[#636363]" strokeWidth={1.7} />
                <div className="min-w-0">
                  <dt className="text-[15px] leading-5 font-[550] text-[#202020]">
                    {field.label}
                  </dt>
                  <dd className="mt-0.5 text-[15px] leading-5 text-[#636363]">
                    {field.value}
                  </dd>
                </div>
              </div>
            )
          })}
        </dl>

        <div className="flex flex-col gap-6">
          <h2 className="text-[24px] leading-7 font-[550] tracking-[-.01em]">
            Overview
          </h2>
        </div>
        <dl className="grid grid-cols-1 gap-x-10 gap-y-5 rounded-2xl bg-[#f7f7f6] p-6 sm:grid-cols-2">
          {overview.map((field) => (
            <div key={field.label} className="min-w-0">
              <dt className="text-[15px] leading-5 font-[550] text-[#202020]">
                {field.label}
              </dt>
              <dd className="mt-0.5 text-[15px] leading-5 text-[#636363]">
                {field.value}
              </dd>
            </div>
          ))}
        </dl>

        {nearby.length > 0 ? (
          <>
            <div className="flex flex-col gap-6">
              <h2 className="text-[24px] leading-7 font-[550] tracking-[-.01em]">
                Facilities &amp; nearby places
              </h2>
            </div>
            <dl className="grid grid-cols-1 gap-x-10 gap-y-5 rounded-2xl bg-[#f7f7f6] p-6 sm:grid-cols-2">
              {nearby.map((place) => (
                <div key={place.label} className="min-w-0">
                  <dt className="text-[15px] leading-5 font-[550] text-[#202020]">
                    {place.label}
                  </dt>
                  <dd className="mt-0.5 text-[15px] leading-5 text-[#636363]">
                    {place.distance}
                  </dd>
                </div>
              ))}
            </dl>
          </>
        ) : null}
      </section>

      {divider}

      <section id="section-location" className={sectionClass}>
        <div className="flex flex-col gap-6">
          <h2 className="text-[24px] leading-7 font-[550] tracking-[-.01em]">
            Where you&rsquo;ll be
          </h2>
        </div>
        <div className="flex flex-col gap-5">
          <p className="text-[16px] leading-6 text-[#636363]">
            {location}, Nepal
          </p>

          {coordinates ? (
            <div className="h-[380px] w-full overflow-hidden rounded-2xl">
              {/* One pin, no bounds reporting — this map shows a single property. */}
              <MapSurface
                markers={[
                  {
                    slug,
                    title,
                    city: `${location}, Nepal`,
                    image: coverImage ?? "/images/featured-1.webp",
                    latitude: coordinates.latitude,
                    longitude: coordinates.longitude,
                  },
                ]}
                focusZoom={15}
              />
            </div>
          ) : null}

          <p className="text-[16px] leading-6 text-[#202020]">
            {title} offers easy access to a variety of outdoor activities and
            charming local attractions. Explore nearby hiking trails, walk the
            valley rim at sunrise, or visit the surrounding towns for markets,
            farm-to-table dining and craft workshops.
          </p>
        </div>
      </section>
    </div>
  )
}

export function StayThingsToKnow({ title }: { title: string }) {
  return (
    <div>
      {divider}
      <section id="section-rules" className={sectionClass}>
        <div className="flex flex-col gap-6">
          <h2 className="text-[24px] leading-7 font-[550] tracking-[-.01em]">
            Things to know
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-x-10">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <FileCheck2 className="size-5 text-[#636363]" />
              <h3 className="text-[16px] leading-5 font-[550]">
                Ownership &amp; documents
              </h3>
            </div>
            <p className="text-[16px] leading-6 text-[#636363]">
              Lalpurja verified against land-registry records before this
              listing was published. Originals are shown at viewing.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Ruler className="size-5 text-[#636363]" />
              <h3 className="text-[16px] leading-5 font-[550]">Land &amp; access</h3>
            </div>
            <p className="text-[16px] leading-6 text-[#636363]">
              Road access and plot boundaries confirmed on site. Exact frontage
              and setbacks are provided with the survey drawing.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-[#636363]" />
              <h3 className="text-[16px] leading-5 font-[550]">
                Buying with Bhumiraj
              </h3>
            </div>
            <p className="text-[16px] leading-6 text-[#636363]">
              An appointed agent handles the viewing, negotiation and transfer.
              No fees to enquire, and no charge until a deal completes.
            </p>
          </div>
        </div>
      </section>

      <nav aria-label="Breadcrumb" className="py-8">
        <ol className="flex flex-wrap items-center gap-3 text-[14px] leading-[17px]">
          {["Home", "Nepal", "Bagmati"].map((item) => (
            <li key={item} className="inline-flex items-center gap-3">
              <a
                href="#"
                className="text-[#636363] hover:underline hover:underline-offset-4"
              >
                {item}
              </a>
              <ChevronRight className="size-3 text-[#636363]" />
            </li>
          ))}
          <li className="text-[#202020]">Bhumiraj {title}</li>
        </ol>
      </nav>
    </div>
  )
}
