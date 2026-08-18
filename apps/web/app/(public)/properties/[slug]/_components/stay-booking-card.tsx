"use client"

import Link from "next/link"
import { BadgeCheck, CalendarDays, ChevronRight, Phone } from "lucide-react"

export type ContactAgentDetails = {
  slug: string
  title: string
  location: string
  price: string
  priceLabel?: string
  agent: {
    id?: string | undefined
    name: string
    role?: string
    verified?: boolean
  }
}

/**
 * Replaces the reference's nightly-booking widget. A sale listing is an enquiry,
 * not a checkout, so this collects intent and routes it to the listing agent.
 */
function AgentIdentity({
  agent,
}: {
  agent: ContactAgentDetails["agent"]
}) {
  return (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#efece9] text-[14px] font-semibold text-[#5b524c]">
        {agent.name.slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 truncate text-[14px] font-[550] text-[#202020]">
          {agent.name}
          {agent.verified ? (
            <BadgeCheck className="size-4 shrink-0 text-emerald-700" />
          ) : null}
        </span>
        <span className="block truncate text-[12px] text-[#636363]">
          {agent.role ?? "Property Agent"}
        </span>
      </span>
    </>
  )
}

export function StayBookingCard({
  details,
  highlight = null,
  onBookViewing,
}: {
  details: ContactAgentDetails
  /** Which CTA the timed nudge is currently pointing at, if any. */
  highlight?: "contact" | "viewing" | null
  onBookViewing?: () => void
}) {
  return (
    <aside
      id="property-booking"
      className="w-full max-w-[400px] lg:sticky lg:top-24"
    >
      <div className="bg-white">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <span className="text-[26px] leading-8 font-[550] text-[#202020]">
              {details.price}
            </span>
            <span className="text-[14px] leading-[17px] text-[#636363]">
              {details.priceLabel ?? "Guide price"}
            </span>
          </div>

          {details.agent.id ? (
            <Link
              href={`/agents/${details.agent.id}`}
              className="flex items-center gap-3 rounded-lg border border-black/[.10] p-3 transition-colors hover:bg-[#f7f7f6]"
            >
              <AgentIdentity agent={details.agent} />
              <ChevronRight className="size-4 shrink-0 text-[#8a8a8a]" />
            </Link>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-black/[.10] p-3">
              <AgentIdentity agent={details.agent} />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#00733d] px-5 text-[16px] font-[550] text-white transition-all hover:bg-[#005a2e] ${
                highlight === "contact"
                  ? "ring-2 ring-[#00733d] ring-offset-2"
                  : ""
              }`}
            >
              <Phone className="size-4" strokeWidth={1.9} />
              Contact agent
            </button>
            <button
              type="button"
              onClick={onBookViewing}
              className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-black/[.12] bg-white px-5 text-[16px] font-[550] text-[#202020] transition-all hover:bg-[#f7f7f6] ${
                highlight === "viewing"
                  ? "ring-2 ring-[#00733d] ring-offset-2"
                  : ""
              }`}
            >
              <CalendarDays className="size-4" strokeWidth={1.9} />
              Book a viewing
            </button>
          </div>

          <p className="text-center text-[14px] leading-[17px] text-[#636363]">
            No fees to enquire
          </p>
        </div>
      </div>
    </aside>
  )
}
