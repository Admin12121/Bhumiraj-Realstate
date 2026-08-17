"use client"

import { Star } from "lucide-react"
import {
  BadgeCheck,
  Eye,
  Gavel,
  Headphones,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { BrandMark } from "./site-footer"

const points = [
  {
    icon: Sparkles,
    title: "Only verified homes",
    text: "Every listing is checked before it goes live, so you never chase a property that does not exist.",
  },
  {
    icon: BadgeCheck,
    title: "Ownership you can trust",
    text: "Title and ownership are confirmed against records before a property is published.",
  },
  {
    icon: Headphones,
    title: "Appointed agents",
    text: "Agents are appointed by the platform and never self-register. You always know who you are dealing with.",
  },
  {
    icon: Gavel,
    title: "Transparent auctions",
    text: "Bids settle against the database, not the fastest connection. Every result is auditable.",
  },
  {
    icon: Eye,
    title: "Real locations",
    text: "Maps and neighbourhood detail on every listing, with private data kept private.",
  },
  {
    icon: ShieldCheck,
    title: "No hidden fees",
    text: "What you see is what you pay. No markups added between you and the seller.",
  },
]

/** The reference's dark "difference" band. */
export function BhumirajDifference() {
  return (
    <section
      id="difference"
      className="mt-20 border-t border-white/10 bg-black py-20 text-[#f7f7f7] md:mt-[104px] md:pt-[104px] md:pb-[120px]"
    >
      <div className="mx-auto grid w-full max-w-site grid-cols-2 gap-x-4 px-6 lg:grid-cols-12 lg:px-8 2xl:px-12">
        <div className="col-span-full lg:col-span-6 lg:pr-10">
          <p className="mb-4 text-[15px] leading-6 text-white/55">
            The Bhumiraj difference
          </p>
          <h2 className="max-w-[760px] text-[clamp(34px,4vw,58px)] leading-[1.02] font-medium tracking-[-0.04em] text-[#f7f7f7]">
            Property, the way it should be.
            <br className="hidden md:block" />{" "}
            <span className="text-white/35">
              Verified homes, real agents, honest prices.
            </span>
          </h2>
        </div>

        <div className="col-span-full mt-12 grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-10 md:gap-y-14 lg:col-span-6 lg:mt-0">
          {points.map(({ icon: Icon, title, text }) => (
            <article key={title} className="flex min-w-0 flex-col gap-4">
              <div className="grid size-10 place-items-center rounded-lg bg-[#151515]">
                <Icon className="size-4 text-[#f7f7f7]" strokeWidth={1.6} />
              </div>
              <div>
                <h3 className="text-[17px] leading-6 font-medium tracking-[-.01em] text-[#f7f7f7] md:text-[18px]">
                  {title}
                </h3>
                <p className="mt-2 max-w-[32ch] text-[14px] leading-6 text-white/50 md:text-[15px]">
                  {text}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

const reviews = [
  [
    "Bishal K.",
    "The agent handled every viewing and the paperwork was ready before we arrived. The whole purchase took weeks, not months.",
  ],
  [
    "Anjali S.",
    "I listed our Lalitpur flat and it was verified within two days. Genuine enquiries only, no time-wasters calling at midnight.",
  ],
  [
    "Rajesh T.",
    "I won a plot at auction and could see exactly where my bid stood the whole time. No confusion about who won.",
  ],
  [
    "Sunita M.",
    "We rented from Pokhara while still living abroad. The photos and the map were exactly right when we arrived.",
  ],
  [
    "Deepak G.",
    "Ownership was checked before the listing went live, which is why I trusted it. That is rare here.",
  ],
] as const

function Stars() {
  return (
    <div
      className="flex shrink-0 items-center gap-[1px]"
      aria-label="5 out of 5 stars"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className="size-[15px] fill-[#fabd05] text-[#fabd05]"
          strokeWidth={0}
        />
      ))}
    </div>
  )
}

function ReviewCard({ name, text }: { name: string; text: string }) {
  return (
    <article
      aria-label={name}
      className="flex h-[296px] w-[400px] shrink-0 flex-col gap-6 rounded-xl bg-white p-6 shadow-review max-lg:h-[260px] max-lg:w-[320px] max-lg:gap-4 max-lg:p-5"
    >
      <header className="flex w-full items-center gap-3">
        <div className="min-w-0 flex-1">
          <span className="block truncate text-[15px] leading-normal font-semibold text-[#221811]">
            {name}
          </span>
        </div>
        <Stars />
      </header>
      <p className="line-clamp-6 flex-1 overflow-hidden text-[20px] leading-normal font-medium italic text-[#221811] max-lg:text-[15px]">
        {text}
      </p>
    </article>
  )
}

/** The reference's review band with a paused-on-hover marquee. */
export function LovedByOwners() {
  return (
    <section
      className="w-full overflow-hidden bg-white"
      aria-labelledby="reviews-title"
    >
      <div className="flex w-full items-center gap-[124px] pt-[120px] pb-[78px] max-lg:flex-wrap max-lg:items-stretch max-lg:gap-x-5 max-lg:gap-y-12 max-lg:py-12">
        <div
          aria-hidden="true"
          className="relative h-[404px] min-w-0 flex-1 overflow-hidden rounded-r-xl bg-[#eef3ee] max-lg:h-[220px] max-lg:basis-[calc(50%-10px)] max-lg:grow-0"
        />

        <div className="flex w-[416px] shrink-0 flex-col items-center gap-9 text-center max-lg:order-3 max-lg:w-full max-lg:gap-6 max-lg:px-6">
          <div className="scale-[1.12]">
            <BrandMark compact />
          </div>
          <div className="flex w-full flex-col gap-3">
            <h2
              id="reviews-title"
              className="m-0 text-[36px] leading-normal font-medium tracking-[-1px] text-[#1d1919] max-lg:text-[28px] max-lg:tracking-[-.75px]"
            >
              Loved by Every Owner, Every Sale
            </h2>
            <p className="m-0 text-[20px] leading-normal font-light text-[#1d1919] max-lg:text-[16px] max-lg:leading-6">
              See why buyers, sellers and renters across Nepal choose Bhumiraj
              and keep coming back
            </p>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="relative h-[404px] min-w-0 flex-1 overflow-hidden rounded-l-xl bg-[#eef3ee] max-lg:order-2 max-lg:h-[220px] max-lg:basis-[calc(50%-10px)] max-lg:grow-0"
        />
      </div>

      <div className="w-full overflow-hidden pt-6 pb-40 max-lg:pt-4 max-lg:pb-14">
        <div className="review-marquee flex w-max hover:[animation-play-state:paused]">
          <div className="flex shrink-0 gap-9 pr-9 max-lg:gap-5 max-lg:pr-5">
            {reviews.map(([name, text], index) => (
              <ReviewCard key={`a-${index}`} name={name} text={text} />
            ))}
          </div>
          <div
            aria-hidden="true"
            className="flex shrink-0 gap-9 pr-9 max-lg:gap-5 max-lg:pr-5"
          >
            {reviews.map(([name, text], index) => (
              <ReviewCard key={`b-${index}`} name={name} text={text} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
