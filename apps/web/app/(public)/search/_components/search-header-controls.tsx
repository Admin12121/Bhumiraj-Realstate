"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Heart,
  Minus,
  Plus,
  SlidersHorizontal,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { PropertySearch } from "@/app/_components/property-search"
import type { SearchCriteria } from "./search-results"


// Reference histogram shape, retained so the distribution reads the same.
const HISTOGRAM = [
  8, 10, 13, 16, 20, 24, 31, 38, 44, 48, 45, 42, 37, 32, 29, 25, 20, 17, 14, 11,
  9, 7, 6, 4, 3, 2,
]

// Property prices, unlike nightly rates, span crores. Step in lakh.
const PRICE_MAX = 100_000_000
const PRICE_STEP = 100_000

function formatLakh(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value)
}

/** The reference's dual-thumb price distribution, scaled to NPR sale prices. */
function PriceDistribution({
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
}: {
  minValue: number
  maxValue: number
  onMinChange: (value: number) => void
  onMaxChange: (value: number) => void
}) {
  const safeMin = Math.min(minValue, maxValue)
  const safeMax = Math.max(maxValue, minValue)
  const left = (safeMin / PRICE_MAX) * 100
  const right = 100 - (safeMax / PRICE_MAX) * 100

  return (
    <div className="flex w-full flex-col">
      <div className="relative px-3">
        <div className="flex h-12 w-full items-end gap-1">
          {HISTOGRAM.map((height, index) => {
            const mid = ((index + 0.5) / HISTOGRAM.length) * PRICE_MAX
            const selected = mid >= safeMin && mid <= safeMax
            return (
              <span
                key={index}
                className={cn(
                  "min-w-0 flex-1 rounded-[2px]",
                  selected ? "bg-[#222]" : "bg-[#e8e8e6]",
                )}
                style={{ height }}
              />
            )
          })}
        </div>

        <div className="relative z-10 -mt-3 h-6">
          <div className="absolute top-[11px] right-0 left-0 h-0.5 bg-[#e5e5e3]" />
          <div
            className="absolute top-[11px] h-0.5 bg-[#222]"
            style={{ left: `${left}%`, right: `${right}%` }}
          />
          <input
            aria-label="Minimum price"
            type="range"
            min={0}
            max={PRICE_MAX}
            step={PRICE_STEP}
            value={safeMin}
            onChange={(event) =>
              onMinChange(Math.min(Number(event.target.value), safeMax))
            }
            className="wander-dual-range absolute inset-0 z-20 w-full appearance-none bg-transparent"
          />
          <input
            aria-label="Maximum price"
            type="range"
            min={0}
            max={PRICE_MAX}
            step={PRICE_STEP}
            value={safeMax}
            onChange={(event) =>
              onMaxChange(Math.max(Number(event.target.value), safeMin))
            }
            className="wander-dual-range absolute inset-0 z-30 w-full appearance-none bg-transparent"
          />
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-[12px] font-medium text-[#222]">Minimum</span>
          <div className="flex h-9 w-[132px] items-center rounded-lg border border-black/[.12] bg-white px-3 text-[14px] text-[#222]">
            <span className="mr-1 text-[#737373]">NPR</span>
            <input
              inputMode="numeric"
              value={formatLakh(safeMin)}
              onChange={(event) => {
                const raw = Number(event.target.value.replace(/\D/g, "")) || 0
                onMinChange(Math.max(0, Math.min(safeMax, raw)))
              }}
              className="w-full min-w-0 bg-transparent tabular-nums outline-none"
            />
          </div>
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[12px] font-medium text-[#222]">Max</span>
          <div className="flex h-9 w-[132px] items-center rounded-lg border border-black/[.12] bg-white px-3 text-[14px] text-[#222]">
            <span className="mr-1 text-[#737373]">NPR</span>
            <input
              inputMode="numeric"
              value={formatLakh(safeMax)}
              onChange={(event) => {
                const raw =
                  Number(event.target.value.replace(/\D/g, "")) || safeMin
                onMaxChange(Math.min(PRICE_MAX, Math.max(safeMin, raw)))
              }}
              className="w-full min-w-0 bg-transparent tabular-nums outline-none"
            />
          </div>
        </label>
      </div>
    </div>
  )
}

/** The reference's −/+ count field, showing "Any" at zero. */
function CountInput({
  value,
  onChange,
  label,
}: {
  value: number
  onChange: (value: number) => void
  label: string
}) {
  const hasValue = value > 0
  return (
    <div className="flex min-w-[152px] items-center justify-between">
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={!hasValue}
        onClick={() => onChange(Math.max(0, value - 1))}
        className="grid size-8 place-items-center rounded-full border border-black/[.12] bg-white text-[#272727] transition hover:bg-[#f6f6f5] disabled:pointer-events-none disabled:opacity-30"
      >
        <Minus className="size-4" strokeWidth={1.6} />
      </button>
      <span className="max-w-[60px] min-w-10 text-center text-[15px] leading-6 text-[#222] tabular-nums">
        {hasValue ? value : "Any"}
      </span>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={value >= 20}
        onClick={() => onChange(Math.min(20, value + 1))}
        className="grid size-8 place-items-center rounded-full border border-black/[.12] bg-white text-[#272727] transition hover:bg-[#f6f6f5] disabled:pointer-events-none disabled:opacity-30"
      >
        <Plus className="size-4" strokeWidth={1.6} />
      </button>
    </div>
  )
}

/** The reference's pill control bar, with Bhumiraj's segments. */
export function SearchHeaderControls({
  criteria,
}: {
  criteria: SearchCriteria
}) {
  const router = useRouter()
  // The search bar owns these now; the page only seeds them from the URL.
  const district = criteria.district ?? ""
  const listingType = criteria.type ?? "SALE"
  const propertyType = criteria.propertyType ?? "ANY"
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const [bedrooms, setBedrooms] = useState(0)
  const [priceMin, setPriceMin] = useState(0)
  const [priceMax, setPriceMax] = useState(PRICE_MAX)
  const priceTouched = priceMin > 0 || priceMax < PRICE_MAX
  const filterCount = (bedrooms > 0 ? 1 : 0) + (priceTouched ? 1 : 0)


  function commit(next?: Partial<SearchCriteria>) {
    const merged = {
      type: next?.type ?? listingType,
      district: next?.district ?? district,
      propertyType: next?.propertyType ?? propertyType,
    }
    const query = new URLSearchParams({ type: merged.type })
    if (merged.district && merged.district !== "All residences") {
      query.set("district", merged.district)
    }
    if (merged.propertyType !== "ANY") {
      query.set("propertyType", merged.propertyType)
    }
    if (bedrooms > 0) query.set("bedrooms", String(bedrooms))
    // The contract carries prices in minor units; the slider works in rupees.
    if (priceMin > 0) query.set("minPriceMinor", `${priceMin * 100}`)
    if (priceMax < PRICE_MAX) query.set("maxPriceMinor", `${priceMax * 100}`)
    router.push(`/search?${query.toString()}`)
  }

  return (
    <div className="flex w-full min-w-0 flex-nowrap items-center gap-2 overflow-visible">
      {/* The same bar as the home hero, so search does not present a second
          set of controls for the same job. */}
      <PropertySearch
        className="min-w-0 flex-1"
        defaults={{ type: listingType, district, propertyType }}
      />

      <Button
        aria-label={filterCount > 0 ? `Filters (${filterCount})` : "Filters"}
        className="relative shrink-0"
        onClick={() => setFiltersOpen(true)}
        size="icon-lg"
        variant="outline"
      >
        <SlidersHorizontal />
        {filterCount > 0 && (
          <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-[#171717] px-1.5 py-0.5 text-[10px] leading-4 text-white">
            {filterCount}
          </span>
        )}
      </Button>

      {/* Saved properties live on their own page; a dialog here duplicated it
          and had nothing to show a signed-out visitor. */}
      <Button
        aria-label="Saved properties"
        className="shrink-0"
        render={<Link href="/account/saved" />}
        size="icon-lg"
        variant="outline"
      >
        <Heart />
      </Button>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogPopup className="sm:max-w-md">
          <DialogPanel className="p-0!">
            <DialogHeader>
              <DialogTitle>Filters</DialogTitle>
            </DialogHeader>

            <div className="mt-4 flex flex-col gap-5 p-6">
              <div>
                <p className="mb-3 text-[13px] font-medium text-[#202020]">
                  Price range
                </p>
                <PriceDistribution
                  minValue={priceMin}
                  maxValue={priceMax}
                  onMinChange={setPriceMin}
                  onMaxChange={setPriceMax}
                />
              </div>

              <div className="flex items-center justify-between gap-6 border-t border-black/[.08] pt-4">
                <span className="text-[15px] text-[#232323]">Bedrooms</span>
                <CountInput
                  value={bedrooms}
                  onChange={setBedrooms}
                  label="bedrooms"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setBedrooms(0)
                  setPriceMin(0)
                  setPriceMax(PRICE_MAX)
                }}
              >
                Clear
              </Button>
              <Button
                onClick={() => {
                  setFiltersOpen(false)
                  commit()
                }}
              >
                Show results
              </Button>
            </DialogFooter>
          </DialogPanel>
        </DialogPopup>
      </Dialog>

      <Dialog open={savedOpen} onOpenChange={setSavedOpen}>
        <DialogPopup className="sm:max-w-md">
          <DialogPanel className="p-0!">
            <DialogHeader>
              <DialogTitle>Saved homes</DialogTitle>
            </DialogHeader>
            <p className="mt-4 rounded-lg bg-[#f7f7f6] p-6 text-center text-[14px] text-[#737373]">
              You have not saved any homes yet.
            </p>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </div>
  )
}
