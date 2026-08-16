"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { PublicHeader } from "@/app/_components/public-header"
import { SiteFooter } from "@/app/_components/site-footer"
import type { Residence } from "@/app/_components/residence-card"
import { StayBookingCard } from "./stay-booking-card"
import { StayGallery } from "./stay-gallery"
import { StaySections, StayThingsToKnow } from "./stay-sections"

const tabs = [
  ["Photos", "section-photos"],
  ["About", "section-about"],
  ["Sleep", "section-sleep"],
  ["Amenities", "section-amenities"],
  ["Location", "section-location"],
  ["Rules", "section-rules"],
] as const

function PropertySectionBar() {
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
        <div className="mx-auto grid w-full max-w-[1832px] grid-cols-12 gap-4 px-8 2xl:px-12">
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
                $1,198
              </div>
              <div className="text-[12px] leading-5 font-normal text-[#636363]">
                for 2 nights
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("property-booking")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className="ml-3 h-10 w-[125px] rounded-full bg-[#00733d] px-2 py-1.5 text-[16px] leading-[18px] font-medium text-white hover:bg-[#006134]"
            >
              Reserve
            </button>
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function StayPage({ residence }: { residence: Residence }) {
  const photos = residence.images ?? [residence.image]

  return (
    <>
      <PublicHeader />
      <PropertySectionBar />
      <main className="bg-white">
        <div className="mx-auto grid max-w-[1832px] grid-cols-2 gap-4 px-6 pt-[73px] pb-[calc(81px+env(safe-area-inset-bottom))] md:grid-cols-6 lg:grid-cols-12 lg:px-8 lg:pt-[88px] lg:pb-0 2xl:px-12">
          <div className="col-span-full md:col-span-6 lg:col-span-12 xl:col-span-10 xl:col-start-2 3xl:col-span-8 3xl:col-start-3">
            <StayGallery photos={photos} title={residence.title} />

            <div className="lg:grid lg:grid-cols-[7fr_5fr] lg:gap-4 3xl:grid-cols-[6fr_4fr] 4xl:grid-cols-[5fr_3fr]">
              <StaySections title={residence.title} location={residence.city} />
              <div className="flex items-start justify-end lg:pb-14">
                <div className="hidden w-full max-w-[400px] lg:block">
                  <StayBookingCard />
                </div>
              </div>
            </div>

            <StayThingsToKnow title={residence.title} />
          </div>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 flex min-h-[81px] items-center justify-between gap-4 border-t border-black/[.08] bg-white px-5 pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div>
          <div className="text-[16px] font-[550]">$1,198</div>
          <div className="mt-0.5 text-[12px] text-[#636363]">for 2 nights</div>
        </div>
        <button className="h-12 min-w-[145px] rounded-full bg-[#00733d] px-5 text-[16px] font-[550] text-white">
          Reserve
        </button>
      </div>

      <SiteFooter />
    </>
  )
}
