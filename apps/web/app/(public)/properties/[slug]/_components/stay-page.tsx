"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import {
  Bath,
  BedDouble,
  Building2,
  CalendarRange,
  CookingPot,
  Layers,
  Phone,
  Route,
  Ruler,
  Sofa,
} from "lucide-react"
import { PublicHeader } from "@/app/_components/public-header"
import { ShareMenu } from "@/app/_components/share-menu"
import { EnquiryNudge } from "@/app/_components/enquiry-nudge"
import { SiteFooter } from "@/app/_components/site-footer"
import type { Residence } from "@/app/_components/residence-card"
import { StayBookingCard } from "./stay-booking-card"
import { StayGallery } from "./stay-gallery"
import { StaySections, StayThingsToKnow } from "./stay-sections"

const tabs = [
  ["Photos", "section-photos"],
  ["About", "section-about"],
  ["Features", "section-amenities"],
  ["Location", "section-location"],
  ["Details", "section-rules"],
] as const

function PropertySectionBar({ price }: { price: string }) {
  const [visible, setVisible] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [manualScroll, setManualScroll] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [indicator, setIndicator] = useState({ x: 0, width: 0, opacity: 0 })

  // Reference trigger: reveal once #section-summary reaches 72px from the top.
  useEffect(() => {
    const updateVisibility = () => {
      const summary = document.getElementById("section-summary")
      if (!summary) {
        setVisible(false)
        return
      }
      setVisible(summary.getBoundingClientRect().top <= 72)
    }

    updateVisibility()
    const onViewportChange = () => requestAnimationFrame(updateVisibility)
    window.addEventListener("scroll", onViewportChange, { passive: true })
    window.addEventListener("resize", onViewportChange, { passive: true })
    return () => {
      window.removeEventListener("scroll", onViewportChange)
      window.removeEventListener("resize", onViewportChange)
    }
  }, [])

  // Track whichever section occupies roughly the first third of the viewport.
  useEffect(() => {
    const updateActiveSection = () => {
      if (manualScroll) return
      requestAnimationFrame(() => {
        const element = document
          .elementFromPoint(window.innerWidth / 3, window.innerHeight / 3)
          ?.closest<HTMLElement>('[id^="section-"]')
        if (!element) return
        const index = tabs.findIndex(([, id]) => id === element.id)
        if (index >= 0) setActiveIndex(index)
      })
    }

    window.addEventListener("scroll", updateActiveSection, { passive: true })
    updateActiveSection()
    return () => window.removeEventListener("scroll", updateActiveSection)
  }, [manualScroll])

  const updateIndicator = useCallback(() => {
    const list = listRef.current
    const button = buttonRefs.current[activeIndex]
    if (!list || !button) return
    const listRect = list.getBoundingClientRect()
    const buttonRect = button.getBoundingClientRect()
    setIndicator({
      x: buttonRect.left - listRect.left,
      width: buttonRect.width,
      opacity: 1,
    })
  }, [activeIndex])

  useLayoutEffect(() => {
    updateIndicator()
  }, [updateIndicator, visible])

  // The underline is measured in pixels, so it has to be re-measured on resize.
  useEffect(() => {
    const onResize = () => requestAnimationFrame(updateIndicator)
    window.addEventListener("resize", onResize, { passive: true })
    return () => window.removeEventListener("resize", onResize)
  }, [updateIndicator])

  function go(id: string, index: number) {
    setManualScroll(true)
    setActiveIndex(index)

    // Offset by the bar's own height so headings do not land underneath it.
    if (id === "section-photos") {
      window.scrollTo({ top: 0, behavior: "smooth" })
    } else {
      const section = document.getElementById(id)
      if (section) {
        window.scrollTo({ top: section.offsetTop - 72, behavior: "smooth" })
      }
    }

    window.setTimeout(() => setManualScroll(false), 1000)
  }

  return (
    <div
      className={`fixed -top-3 left-0 z-40 m-0 hidden w-full py-3 transition-all duration-300 ease-out will-change-transform lg:-mt-1.5 lg:block ${
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-full opacity-0"
      }`}
    >
      <div className="flex h-[65px] w-full items-center justify-center border-b border-black/[.08] bg-white">
        <div className="mx-auto grid w-full max-w-site grid-cols-12 gap-4 px-8 2xl:px-12">
          <div className="col-span-10 col-start-2 flex items-center justify-between 3xl:col-span-8 3xl:col-start-3">
          <nav aria-label="Property sections">
            <div
              ref={listRef}
              className="relative inline-flex h-[65px] items-center gap-6 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:-z-10 after:h-px after:bg-black/[.08]"
            >
              {tabs.map(([label, id], index) => (
                <button
                  key={id}
                  ref={(node) => {
                    buttonRefs.current[index] = node
                  }}
                  type="button"
                  aria-current={activeIndex === index ? "location" : undefined}
                  onClick={() => go(id, index)}
                  className={`-mb-px h-[65px] border-b-2 border-transparent px-0 py-6 text-[14px] font-medium whitespace-nowrap transition-colors ${
                    activeIndex === index
                      ? "text-[#202020]"
                      : "text-[#636363] hover:text-[#202020]"
                  }`}
                >
                  <span className="px-0.5">{label}</span>
                </button>
              ))}

              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 left-0 h-0.5 bg-[#202020] transition-[width,transform,opacity] duration-200 ease-in-out"
                style={{
                  transform: `translateX(${indicator.x}px)`,
                  width: `${indicator.width}px`,
                  opacity: indicator.opacity,
                }}
              />
            </div>
          </nav>

          <div className="relative top-0.5 flex items-center justify-center gap-3">
            <div className="flex flex-col items-start justify-center">
              <div className="pt-[5px] text-[16px] leading-5 font-medium">
                {price}
              </div>
              <div className="text-[12px] leading-5 font-normal text-[#636363]">
                Guide price
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("property-booking")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className="ml-3 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#00733d] px-4 text-[15px] leading-[18px] font-medium text-white hover:bg-[#006134]"
            >
              <Phone className="size-4" strokeWidth={1.9} />
              Contact agent
            </button>
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function StayPage({ residence }: { residence: Residence }) {
  const [highlight, setHighlight] = useState<"contact" | "viewing" | null>(null)
  const photos = residence.images ?? [residence.image]
  const price = "NPR 4,25,00,000"
  const facts = residence.rooms.split(" · ")
  const bedrooms = facts[0] ?? "—"
  const bathrooms = facts[1] ?? "—"
  const area = facts[2] ?? "—"

  const detail = [
    { icon: Building2, label: "Property Type", value: "House" },
    { icon: Ruler, label: "Area", value: area },
    { icon: BedDouble, label: "Bedroom", value: bedrooms },
    { icon: Bath, label: "Bathroom", value: bathrooms },
    { icon: CookingPot, label: "Kitchen", value: "2 Kitchen" },
    { icon: Sofa, label: "Living Room", value: "2 Rooms" },
    { icon: Layers, label: "Storey", value: "2.5" },
    { icon: Route, label: "Road Access", value: "20 ft" },
    { icon: CalendarRange, label: "Built Year", value: "2023" },
  ]

  const overview = [
    { label: "Property Face", value: "North East" },
    { label: "Furnishing", value: "Semi furnished" },
    { label: "City & Area", value: `${residence.city}, Nepal` },
  ]

  const nearby = [
    { label: "School", distance: "1 km" },
    { label: "College", distance: "1 km" },
    { label: "Hospital", distance: "1 km" },
    { label: "Pharmacy", distance: "1 km" },
    { label: "Public transport", distance: "0.5 km" },
    { label: "Supermarket", distance: "3.3 km" },
    { label: "Bank", distance: "1 km" },
    { label: "Ward office", distance: "2 km" },
    { label: "Police station", distance: "1 km" },
    { label: "Airport", distance: "11 km" },
  ]
  const description = `${residence.title} is a ${residence.rooms.toLowerCase()} property in ${residence.city}. Ownership documents are verified against land-registry records, the plot has direct road access, and municipal water and electricity are already connected. The building is ready to occupy, with no outstanding dues or disputes on the title. An appointed Bhumiraj agent can arrange a viewing, walk you through the lalpurja and survey drawing, and handle negotiation and transfer end to end.`
  const agent = { name: "Bishap Jaisi", verified: true }
  const contact = {
    slug: residence.slug,
    title: residence.title,
    location: `${residence.city}, Nepal`,
    price,
    specs: [
      { label: "Property type", value: "House" },
      { label: "Listing", value: "For sale" },
      ...facts.map((fact, index) => ({
        label: ["Bedrooms", "Bathrooms", "Land area"][index] ?? "Detail",
        value: fact,
      })),
    ],
    agent,
  }

  return (
    <>
      <PublicHeader />
      <PropertySectionBar price={price} />
      <main className="bg-white">
        <div className="mx-auto grid max-w-site grid-cols-2 gap-4 px-6 pt-[73px] pb-[calc(81px+env(safe-area-inset-bottom))] md:grid-cols-6 lg:grid-cols-12 lg:px-8 lg:pt-[88px] lg:pb-0 2xl:px-12">
          <div className="col-span-full md:col-span-6 lg:col-span-12 xl:col-span-10 xl:col-start-2 3xl:col-span-8 3xl:col-start-3">
            <StayGallery photos={photos} title={residence.title} />

            <div className="lg:grid lg:grid-cols-[7fr_5fr] lg:gap-4 3xl:grid-cols-[6fr_4fr] 4xl:grid-cols-[5fr_3fr]">
              <StaySections
                title={residence.title}
                location={residence.city}
                slug={residence.slug}
                description={description}
                detail={detail}
                overview={overview}
                nearby={nearby}
                {...(residence.latitude != null && residence.longitude != null
                  ? {
                      coordinates: {
                        latitude: residence.latitude,
                        longitude: residence.longitude,
                      },
                    }
                  : {})}
                coverImage={photos[0]}
              />
              <div className="flex items-start justify-end lg:pb-14">
                <div className="hidden w-full max-w-[400px] lg:block">
                  <StayBookingCard details={contact} highlight={highlight} />
                </div>
              </div>
            </div>

            <StayThingsToKnow title={residence.title} />
          </div>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 flex min-h-[81px] items-center justify-between gap-4 border-t border-black/[.08] bg-white px-5 pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div>
          <div className="text-[16px] font-[550]">{price}</div>
          <div className="mt-0.5 text-[12px] text-[#636363]">Guide price</div>
        </div>
        <div className="flex items-center gap-2">
          <ShareMenu
            iconOnly
            details={{
              title: residence.title,
              text: `${price} · ${residence.city}, Nepal`,
              path: `/properties/${residence.slug}`,
            }}
            className="grid size-12 place-items-center rounded-full border border-black/[.12] bg-white text-[#202020]"
          />
          <button className="inline-flex h-12 min-w-[145px] items-center justify-center gap-2 rounded-full bg-[#00733d] px-5 text-[16px] font-[550] text-white">
            <Phone className="size-4" strokeWidth={1.9} />
            Contact agent
          </button>
        </div>
      </div>

      <EnquiryNudge agentName={agent.name} onHighlight={setHighlight} />

      <SiteFooter />
    </>
  )
}
