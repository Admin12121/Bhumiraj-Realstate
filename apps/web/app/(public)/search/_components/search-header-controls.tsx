"use client"

import { useRouter } from "next/navigation"
import { useState, type ReactNode } from "react"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Building2,
  Check,
  Heart,
  Home,
  Minus,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { SearchCriteria } from "./search-results"

const DISTRICTS = [
  "All residences",
  "Kathmandu",
  "Lalitpur",
  "Bhaktapur",
  "Pokhara",
  "Chitwan",
]

const LISTING_TYPES = [
  { value: "SALE", label: "Buy" },
  { value: "RENT", label: "Rent" },
]

const PROPERTY_TYPES = [
  { value: "ANY", label: "Any property" },
  { value: "HOUSE", label: "House" },
  { value: "APARTMENT", label: "Apartment" },
  { value: "LAND", label: "Land" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "OFFICE", label: "Office" },
  { value: "WAREHOUSE", label: "Warehouse" },
]

const SEGMENT =
  "flex h-11 min-w-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-medium text-[#555] outline-none transition hover:bg-black/[.035] focus-visible:ring-1 focus-visible:ring-black/30"

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

function SegmentLabel({
  children,
  icon,
}: {
  children: ReactNode
  icon?: ReactNode
}) {
  return (
    <>
      {icon}
      <span className="max-w-[132px] truncate">{children}</span>
    </>
  )
}

function Divider() {
  return <span className="h-5 w-px shrink-0 bg-black/[.10]" />
}

const POPOVER =
  "w-[344px] rounded-[24px] border-black/[.08] p-0 shadow-[0_16px_50px_rgba(0,0,0,.16)]"

/** The reference's pill control bar, with Bhumiraj's segments. */
export function SearchHeaderControls({
  criteria,
}: {
  criteria: SearchCriteria
}) {
  const router = useRouter()
  const [district, setDistrict] = useState(criteria.district ?? "")
  const [listingType, setListingType] = useState(criteria.type ?? "SALE")
  const [propertyType, setPropertyType] = useState(
    criteria.propertyType ?? "ANY",
  )
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const [bedrooms, setBedrooms] = useState(0)
  const [priceMin, setPriceMin] = useState(0)
  const [priceMax, setPriceMax] = useState(PRICE_MAX)
  const priceTouched = priceMin > 0 || priceMax < PRICE_MAX
  const filterCount = (bedrooms > 0 ? 1 : 0) + (priceTouched ? 1 : 0)

  const typeLabel =
    LISTING_TYPES.find((item) => item.value === listingType)?.label ?? "Buy"
  const propertyLabel =
    PROPERTY_TYPES.find((item) => item.value === propertyType)?.label ??
    "Any property"

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
      <div
        className="relative isolate flex h-12 min-w-[430px] flex-1 items-center gap-1 rounded-full border border-black/[.12] bg-white p-px shadow-[0_2px_12px_rgba(0,0,0,.08)] transition-[box-shadow,background-color] duration-200 hover:shadow-[0_3px_16px_rgba(0,0,0,.10)]"
        data-slot="search-bar-desktop"
      >
        <Popover>
          <PopoverTrigger
            render={
              <button
                type="button"
                className={cn(SEGMENT, "min-w-[112px] flex-1 justify-start pr-3 pl-4 text-[#666]")}
              />
            }
          >
            <SegmentLabel
              icon={
                <Search className="size-5 shrink-0 text-[#666]" strokeWidth={1.7} />
              }
            >
              {district || "Where"}
            </SegmentLabel>
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={10} className={POPOVER}>
            <div className="border-b border-black/[.08] p-3">
              <div className="flex h-12 items-center rounded-xl bg-[#f5f5f4] px-4">
                <Search className="mr-2 size-4 text-[#6d6d6d]" />
                <input
                  value={district}
                  onChange={(event) => setDistrict(event.target.value)}
                  placeholder="Search locations..."
                  aria-label="Search locations"
                  className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#989898]"
                />
              </div>
            </div>
            <div className="p-3">
              <p className="px-2 pb-2 text-[12px] text-[#8a8a8a]">
                Suggested regions
              </p>
              {DISTRICTS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setDistrict(item === "All residences" ? "" : item)
                    commit({ district: item })
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-[14px] hover:bg-black/[.04]"
                >
                  {item}
                  {district === item && <Check className="size-4" />}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Divider />

        <Popover>
          <PopoverTrigger
            render={
              <button
                type="button"
                className={cn(SEGMENT, "min-w-[108px] shrink-0 justify-center px-3 text-[#272727]")}
              />
            }
          >
            <SegmentLabel>{typeLabel}</SegmentLabel>
          </PopoverTrigger>
          <PopoverContent align="center" sideOffset={10} className={POPOVER}>
            <div className="p-3">
              {LISTING_TYPES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setListingType(item.value)
                    commit({ type: item.value })
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-[14px] hover:bg-black/[.04]"
                >
                  <span className="flex items-center gap-2">
                    <Home className="size-4 text-[#666]" />
                    {item.label}
                  </span>
                  {listingType === item.value && <Check className="size-4" />}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Divider />

        <div className="group/action relative z-10 ml-auto flex h-11 min-w-0 items-center gap-1 rounded-full">
          <Popover>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  className={cn(SEGMENT, "w-[130px] shrink-0 justify-center px-3 text-[#666]")}
                />
              }
            >
              <SegmentLabel>{propertyLabel}</SegmentLabel>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={10} className={POPOVER}>
              <div className="p-3">
                {PROPERTY_TYPES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      setPropertyType(item.value)
                      commit({ propertyType: item.value })
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-[14px] hover:bg-black/[.04]"
                  >
                    <span className="flex items-center gap-2">
                      <Building2 className="size-4 text-[#666]" />
                      {item.label}
                    </span>
                    {propertyType === item.value && <Check className="size-4" />}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <button
            type="button"
            onClick={() => commit()}
            className="mr-px grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#171717] text-white transition hover:bg-black"
            aria-label="Search"
          >
            <Search className="size-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setFiltersOpen(true)}
        className="relative flex h-12 shrink-0 items-center gap-2 rounded-full border border-black/[.11] bg-white px-4 text-[14px] font-medium text-[#252525] transition hover:bg-[#f7f7f6]"
      >
        <SlidersHorizontal className="size-4" strokeWidth={1.7} />
        Filters
        {filterCount > 0 && (
          <span className="grid min-w-5 place-items-center rounded-full bg-[#171717] px-1.5 py-0.5 text-[10px] leading-4 text-white">
            {filterCount}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => setSavedOpen(true)}
        className="flex h-12 shrink-0 items-center gap-2 rounded-full border border-black/[.11] bg-white px-4 text-[14px] font-medium text-[#252525] transition hover:bg-[#f7f7f6]"
      >
        <Heart className="size-4" strokeWidth={1.7} />
        Saved
      </button>

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
