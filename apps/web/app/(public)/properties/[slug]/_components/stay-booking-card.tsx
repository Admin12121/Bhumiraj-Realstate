"use client"

import { useState } from "react"
import { ChevronDown, Minus, Plus, Users } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function StayBookingCard() {
  const [guests, setGuests] = useState(2)
  const [checkIn, setCheckIn] = useState("2026-09-01")
  const [checkOut, setCheckOut] = useState("2026-09-03")

  return (
    <aside id="property-booking" className="w-full max-w-[400px] lg:sticky lg:top-24">
      <div className="overflow-hidden rounded-xl border border-black/[.04] bg-white p-7 shadow-[0_0_0_1px_rgba(0,0,0,.04),0_3px_12px_rgba(0,0,0,.06),0_1px_4px_rgba(0,0,0,.06)]">
        <div className="flex flex-col gap-6">
          <div className="flex h-7 items-center justify-between gap-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[24px] leading-7 font-[550] text-[#202020]">
                $1,198
              </span>
              <span className="text-[14px] leading-[17px] text-[#636363]">
                for 2 nights
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <label className="flex h-[68px] flex-1 cursor-pointer flex-col justify-center rounded-lg border border-black/[.10] bg-white px-4 hover:border-black/[.20]">
                <span className="text-[12px] leading-[15px] font-[550] text-[#636363]">
                  Check in
                </span>
                <input
                  type="date"
                  value={checkIn}
                  onChange={(event) => setCheckIn(event.target.value)}
                  className="mt-1 min-w-0 bg-transparent text-[14px] leading-[17px] text-[#202020] outline-none"
                />
              </label>
              <label className="flex h-[68px] flex-1 cursor-pointer flex-col justify-center rounded-lg border border-black/[.10] bg-white px-4 hover:border-black/[.20]">
                <span className="text-[12px] leading-[15px] font-[550] text-[#636363]">
                  Check out
                </span>
                <input
                  type="date"
                  value={checkOut}
                  onChange={(event) => setCheckOut(event.target.value)}
                  className="mt-1 min-w-0 bg-transparent text-[14px] leading-[17px] text-[#202020] outline-none"
                />
              </label>
            </div>

            <Popover>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className="flex h-[68px] w-full items-center justify-between rounded-lg border border-black/[.10] bg-white px-4 text-left hover:border-black/[.20]"
                  >
                    <span className="flex flex-col gap-1">
                      <span className="text-[12px] leading-[15px] font-[550] text-[#636363]">
                        Guests
                      </span>
                      <span className="flex items-center gap-2 text-[14px] leading-[17px]">
                        <Users className="size-4" />
                        {guests} guests
                      </span>
                    </span>
                    <ChevronDown className="size-4 text-[#636363]" />
                  </button>
                }
              />
              <PopoverContent
                align="end"
                sideOffset={8}
                className="w-[300px] rounded-xl border border-black/[.08] bg-white p-4 shadow-[0_2px_16px_rgba(0,0,0,.12)]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[14px] font-[550]">Guests</div>
                    <div className="mt-1 text-[12px] text-[#636363]">
                      Maximum 5 guests
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="Decrease guests"
                      disabled={guests <= 1}
                      onClick={() => setGuests((value) => Math.max(1, value - 1))}
                      className="grid size-8 place-items-center rounded-full bg-[#f0f0f0] disabled:opacity-35"
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="w-5 text-center text-[14px]">{guests}</span>
                    <button
                      type="button"
                      aria-label="Increase guests"
                      disabled={guests >= 5}
                      onClick={() => setGuests((value) => Math.min(5, value + 1))}
                      className="grid size-8 place-items-center rounded-full bg-[#f0f0f0] disabled:opacity-35"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-col gap-4">
            <button
              type="button"
              className="h-12 w-full rounded-full bg-[#00733d] px-5 text-[16px] font-[550] text-white transition-colors hover:bg-[#005a2e]"
            >
              Reserve
            </button>
            <p className="text-center text-[14px] leading-[17px] text-[#636363]">
              You won&rsquo;t be charged yet
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
