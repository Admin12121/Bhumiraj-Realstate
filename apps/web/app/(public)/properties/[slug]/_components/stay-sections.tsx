"use client"

import { useRef, useState } from "react"
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  CigaretteOff,
  Clock3,
  Heart,
  PartyPopper,
  PawPrint,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react"

const sectionClass = "flex flex-col gap-6 py-8 lg:gap-8 lg:py-10"
const divider = (
  <div aria-hidden="true" className="h-px w-full bg-black/[.08]" />
)

const reviews = [
  {
    initial: "I",
    name: "Igor",
    date: "February 2026",
    text: "We had a wonderful stay at this home and truly enjoyed every moment. The house is beautiful, very modern, and located in a stunning scenic area surrounded by nature. Everything was exceptionally clean and well maintained, which made us feel comfortable right away. The kitchen was fully equipped with all the necessary cookware and utensils, so preparing meals was easy and enjoyable.",
  },
  {
    initial: "C",
    name: "Caitlin",
    date: "January 2026",
    text: "Our long weekend at this property was perfection. A well-stocked kitchen, stunning views from every room, a fantastic fireplace, cozy beds, all on a quiet and secluded but easy to access lot. We would return in a heartbeat!",
  },
  {
    initial: "S",
    name: "Suzie",
    date: "August 2025",
    text: "Loved this place! Beautifully designed—very clean, minimal, cozy. The pool and hot tub are awesome. It was just like staying at a hotel with the amenities. The concierge service was amazing—we were able to check in early and they brought us coffee when we ran out.",
  },
]

const bedrooms = [
  { name: "Bedroom 1", bed: "1 king bed", image: "/images/bedroom-1.webp" },
  { name: "Bedroom 2", bed: "1 queen bed", image: "/images/bedroom-2.webp" },
  { name: "Bedroom 3", bed: "1 twin bed", image: "/images/bedroom-3.webp" },
]

const amenities = [
  "Fire pit",
  "Fire place",
  "Forest view",
  "BBQ Area",
  "Hot tub",
  "Outdoor pool",
  "Foosball table",
  "Wifi",
]

function Stars() {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} className="size-3 fill-current" strokeWidth={1.5} />
      ))}
    </div>
  )
}

export function StaySections({
  title,
  location,
}: {
  title: string
  location: string
}) {
  const sleepRef = useRef<HTMLDivElement>(null)
  const [expandedReviews, setExpandedReviews] = useState(false)

  const scrollSleep = (direction: number) => {
    sleepRef.current?.scrollBy({ left: direction * 360, behavior: "smooth" })
  }

  return (
    <div>
      <section id="section-summary" className={`${sectionClass} pt-0`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2.5">
            <div className="flex flex-col gap-2.5">
              <h2 className="text-[16px] leading-5 font-normal text-[#636363]">
                Home in {location}
              </h2>
              <h1 className="text-[24px] leading-7 font-[550] tracking-[-.01em] text-[#202020]">
                {title}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[16px] leading-5 text-[#636363]">
              <span>3 bedrooms</span>
              <span className="text-[#8e8e8e]">•</span>
              <span>3 beds</span>
              <span className="text-[#8e8e8e]">•</span>
              <span>2 bathrooms</span>
              <span className="text-[#8e8e8e]">•</span>
              <span>5 guests</span>
              <span className="hidden text-[#8e8e8e] md:inline">•</span>
              <a
                href="#section-reviews"
                className="hidden items-center gap-1 text-[#202020] underline md:inline-flex"
              >
                <Star className="size-3.5 fill-current" />
                4.5 (61)
              </a>
            </div>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <button
              aria-label="Save home"
              className="grid size-10 place-items-center rounded-full bg-[#f0f0f0] text-[#202020] hover:bg-[#eaeaea]"
            >
              <Heart className="size-4" />
            </button>
            <button
              aria-label="Share home"
              className="grid size-10 place-items-center rounded-full bg-[#f0f0f0] text-[#202020] hover:bg-[#eaeaea]"
            >
              <Share2 className="size-4" />
            </button>
          </div>
        </div>

        <button
          type="button"
          className="relative flex cursor-pointer flex-col overflow-hidden rounded-2xl bg-white p-5 text-left md:flex-row md:items-stretch md:p-6"
        >
          <div className="flex flex-row items-center gap-1.5 pr-0 md:flex-col md:items-start md:gap-1 md:pr-6">
            <div className="flex shrink-0 items-center gap-1">
              <Star className="size-[14px] fill-current" />
              <span className="text-[16px] leading-5 font-semibold whitespace-nowrap">
                4.5
              </span>
            </div>
            <span className="text-[14px] text-[#8e8e8e] md:hidden">•</span>
            <span className="text-[14px] leading-[17px] text-[#636363]">
              61 reviews
            </span>
          </div>
          <div className="hidden self-stretch border-l border-black/[.08] md:block" />
          <div className="flex flex-1 items-center pt-4 md:pt-0 md:pl-6">
            <h3 className="text-[16px] leading-5 font-[550] text-[#202020]">
              Guests love the fire pit, fire place, forest view and more.
            </h3>
          </div>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-3xl border border-black/[.05]"
          />
        </button>

        <div className="flex flex-col gap-8 lg:mt-2">
          <div className="flex w-full items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white px-1 shadow-[0_1px_4px_rgba(0,0,0,.06),0_3px_12px_rgba(0,0,0,.06),0_0_0_1px_rgba(0,0,0,.04)]">
              <Sparkles className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] leading-5 font-[550]">Luxury</p>
              <p className="mt-1 text-[14px] leading-[17px] text-[#636363]">
                Elevated properties with standout design
              </p>
            </div>
          </div>
          <div className="flex w-full items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white px-1 shadow-[0_1px_4px_rgba(0,0,0,.06),0_3px_12px_rgba(0,0,0,.06),0_0_0_1px_rgba(0,0,0,.04)]">
              <BadgeCheck className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] leading-5 font-[550]">
                Operated by Bhumiraj
              </p>
              <p className="mt-1 text-[14px] leading-5 text-[#636363]">
                Every detail handled by our in-house team
              </p>
            </div>
          </div>
        </div>
      </section>

      {divider}

      <section id="section-about" className={sectionClass}>
        <div className="flex flex-col gap-6">
          <h2 className="text-[24px] leading-7 font-[550] tracking-[-.01em]">
            About the property
          </h2>
          <div className="text-[16px] leading-6 text-[#636363]">
            <div className="overflow-hidden transition-all duration-500 ease-out">
              <div className="line-clamp-3">
                <p>
                  Perched above the valley, {title} is a modern chalet that
                  blends minimalist design with classic charm. This versatile
                  retreat features soaring vaulted ceilings, a gourmet kitchen, a
                  cozy fireplace, and a dramatic glass window wall that invites
                  the outdoors in. Step outside to enjoy a serene outdoor pool
                  and hot tub, a spacious deck with a BBQ area, and a fire pit
                  nestled beneath the trees.
                </p>
                <div className="pt-4">
                  Property License: Cert. of Authority #11856
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {divider}

      <section id="section-sleep" className={sectionClass}>
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[24px] leading-7 font-[550] tracking-[-.01em]">
              Where you&rsquo;ll sleep
            </h2>
            <div className="hidden items-center gap-1 md:flex">
              <button
                type="button"
                aria-label="Previous bedroom"
                onClick={() => scrollSleep(-1)}
                className="grid size-8 place-items-center rounded-full bg-[#f0f0f0] hover:bg-[#eaeaea]"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Next bedroom"
                onClick={() => scrollSleep(1)}
                className="grid size-8 place-items-center rounded-full bg-[#f0f0f0] hover:bg-[#eaeaea]"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
        <div
          ref={sleepRef}
          className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {bedrooms.map((room) => (
            <div
              key={room.name}
              className="flex max-w-[60vw] min-w-[60vw] shrink-0 snap-start flex-col items-start md:max-w-[40%] md:min-w-[40%] lg:max-w-[calc(50%-8px)] lg:min-w-[calc(50%-8px)]"
            >
              <button
                type="button"
                className="mb-3 aspect-[136/93] w-full overflow-hidden rounded-xl"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={room.image}
                  alt={`${room.name} image`}
                  className="h-full w-full object-cover"
                />
              </button>
              <div className="flex flex-col gap-1.5">
                <p className="text-[16px] leading-5 font-[550]">{room.name}</p>
                <p className="text-[14px] leading-[17px] text-[#636363]">
                  {room.bed}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {divider}

      <section id="section-amenities" className={sectionClass}>
        <div className="flex flex-col gap-6">
          <h2 className="text-[24px] leading-7 font-[550] tracking-[-.01em]">
            Amenities
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {amenities.map((item) => (
            <p key={item} className="text-[16px] leading-6 text-[#202020]">
              {item}
            </p>
          ))}
        </div>
      </section>

      {divider}

      <section
        id="section-reviews"
        className={`${sectionClass} scroll-mt-24`}
      >
        <h2 className="flex items-center gap-2 text-[24px] leading-7 font-[550] tracking-[-.01em]">
          <Star className="size-5 fill-current" />
          4.5 · 61 reviews
        </h2>
        <div className="flex flex-col gap-10">
          {reviews.map((review) => (
            <article key={review.name} className="flex flex-col gap-1.5">
              <div className="mb-1.5 flex items-center gap-3">
                <span className="grid size-6 place-items-center rounded-full bg-[#f0f0f0] text-[12px] font-[550] text-[#8e8e8e]">
                  {review.initial}
                </span>
                <p className="text-[16px] leading-6">{review.name}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Stars />
                <span className="text-[14px] text-[#8e8e8e]">•</span>
                <span className="text-[14px] leading-[17px] text-[#636363]">
                  {review.date}
                </span>
              </div>
              <p
                className={`text-[16px] leading-6 text-[#202020] ${
                  expandedReviews ? "" : "line-clamp-2"
                }`}
              >
                {review.text}
              </p>
            </article>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setExpandedReviews((value) => !value)}
          className="h-12 w-full rounded-full bg-[#f0f0f0] px-5 text-[16px] font-[550] hover:bg-[#eaeaea]"
        >
          {expandedReviews ? "Show less" : "Show all reviews"}
        </button>
      </section>

      <button
        type="button"
        className="mb-12 flex w-full items-center gap-4 rounded-xl bg-[#f7f7f7] p-6 text-left"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,.04),0_3px_12px_rgba(0,0,0,.06),0_1px_4px_rgba(0,0,0,.06)]">
          <ShieldCheck className="size-6" />
        </span>
        <span className="flex flex-1 flex-col items-start">
          <span className="text-[16px] leading-5 font-[550]">
            The Bhumiraj Guarantee
          </span>
          <span className="mt-1 text-[14px] leading-[17px] text-[#636363]">
            Book with confidence.{" "}
            <span className="text-[#202020] underline-offset-4 hover:underline">
              Read more.
            </span>
          </span>
        </span>
      </button>

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
              <BadgeCheck className="size-5 text-[#636363]" />
              <h3 className="text-[16px] leading-5 font-[550]">
                Cancellation policy
              </h3>
            </div>
            <p className="line-clamp-3 text-[16px] leading-6 text-[#636363]">
              Free cancellation up to 14 days before check-in. No refund after
              that.
            </p>
            <button className="w-fit text-[16px] leading-6 text-[#636363] underline underline-offset-4">
              Read more
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-[16px] leading-5 font-[550]">Property rules</h3>
            <div className="flex items-center gap-2">
              <PawPrint className="size-5 text-[#636363]" />
              <p className="text-[16px] leading-6 text-[#636363]">
                Pets not allowed
              </p>
            </div>
            <div className="flex items-center gap-2">
              <CigaretteOff className="size-5 text-[#636363]" />
              <p className="text-[16px] leading-6 text-[#636363]">
                No smoking - fees will apply
              </p>
            </div>
            <div className="flex items-center gap-2">
              <PartyPopper className="size-5 text-[#636363]" />
              <p className="text-[16px] leading-6 text-[#636363]">
                Events not allowed
              </p>
            </div>
            <button className="w-fit text-[16px] leading-6 text-[#636363] underline underline-offset-4">
              Read more
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-[16px] leading-5 font-[550]">
              Safety &amp; security
            </h3>
            <div className="flex items-center gap-2">
              <Clock3 className="size-5 text-[#636363]" />
              <p className="text-[16px] leading-6 text-[#636363]">
                Check-in after 4:00 pm
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Clock3 className="size-5 text-[#636363]" />
              <p className="text-[16px] leading-6 text-[#636363]">
                Check-out before 10:00 am
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Users className="size-5 text-[#636363]" />
              <p className="text-[16px] leading-6 text-[#636363]">
                5 guests maximum
              </p>
            </div>
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
