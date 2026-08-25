"use client"

import { useRouter } from "next/navigation"
import { useRef, useState, type FormEvent } from "react"
import { Building2, Home, MapPin, Search } from "lucide-react"
import { VanishingSearchInput } from "./vanishing-search-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/** Buy and rent map onto the listing types the feed already understands. */
const LISTING_TYPES = [
  { value: "SALE", label: "Buy" },
  { value: "RENT", label: "Rent" },
  { value: "ANY", label: "All" },
] as const

const PROPERTY_TYPES = [
  { value: "ANY", label: "Any property" },
  { value: "HOUSE", label: "House" },
  { value: "APARTMENT", label: "Apartment" },
  { value: "LAND", label: "Land" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "OFFICE", label: "Office" },
  { value: "WAREHOUSE", label: "Warehouse" },
] as const

export type PropertySearchDefaults = {
  type?: string
  district?: string
  propertyType?: string
}

/**
 * The segmented search frame from the reference, carrying Bhumiraj's accent
 * rather than the reference's booking palette. Segments are
 * [type] [location] [property] [search].
 */
export function PropertySearch({
  defaults,
  className = "",
}: {
  defaults?: PropertySearchDefaults
  className?: string
}) {
  const router = useRouter()
  const [listingType, setListingType] = useState(defaults?.type ?? "SALE")
  const [district, setDistrict] = useState(defaults?.district ?? "")
  const [propertyType, setPropertyType] = useState(
    defaults?.propertyType ?? "ANY"
  )

  function submit(event: FormEvent) {
    event.preventDefault()
    // "All" means no type filter at all, so it is left off the query.
    const query = new URLSearchParams()
    if (listingType !== "ANY") query.set("type", listingType)
    if (district.trim()) query.set("district", district.trim())
    if (propertyType !== "ANY") query.set("propertyType", propertyType)
    router.push(`/search?${query.toString()}`)
  }

  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      aria-label="Search properties"
      className={`mx-auto flex w-full max-w-[1140px] flex-col rounded-[8px] bg-[#1d1919] p-1 lg:flex-row ${className}`}
    >
      <div className="flex min-h-[44px] w-full min-w-0 items-center rounded-[6px] bg-white px-3 lg:w-[20%]">
        <Home className="mr-2 size-5 shrink-0 text-[#1d1919]" strokeWidth={1.65} />
        <Select
          items={LISTING_TYPES as unknown as { value: string; label: string }[]}
          value={listingType}
          onValueChange={(value) => setListingType(value ?? "SALE")}
        >
          <SelectTrigger
            aria-label="Buy or rent"
            className="h-auto w-full min-w-0 border-0 bg-transparent px-0 text-[14px] font-medium text-[#1d1919] shadow-none outline-none focus-visible:border-0 focus-visible:ring-0 before:shadow-none! [&_svg]:me-0"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LISTING_TYPES.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-1 flex min-h-[44px] min-w-0 flex-1 items-center rounded-[6px] bg-white px-3 lg:mt-0 lg:ml-1">
        <MapPin className="mr-2 size-5 shrink-0 text-[#1d1919]" strokeWidth={1.65} />
        <label className="sr-only" htmlFor="search-district">
          Location
        </label>
        <VanishingSearchInput
          id="search-district"
          value={district}
          onValueChange={setDistrict}
          onSubmit={() => formRef.current?.requestSubmit()}
          className="h-full w-full min-w-0 bg-transparent text-[14px] font-medium text-[#1d1919] outline-none placeholder:text-[#737373]"
        />
      </div>

      <div className="mt-1 flex min-h-[44px] w-full min-w-0 items-center rounded-[6px] bg-white px-3 lg:mt-0 lg:ml-1 lg:w-[24%]">
        <Building2 className="mr-2 size-5 shrink-0 text-[#1d1919]" strokeWidth={1.65} />
        <Select
          items={PROPERTY_TYPES as unknown as { value: string; label: string }[]}
          value={propertyType}
          onValueChange={(value) => setPropertyType(value ?? "ANY")}
        >
          <SelectTrigger
            aria-label="Property type"
            className="h-auto w-full min-w-0 border-0 bg-transparent px-0 text-[14px] font-medium text-[#1d1919] shadow-none outline-none focus-visible:border-0 focus-visible:ring-0 before:shadow-none! [&_svg]:me-0"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROPERTY_TYPES.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-1 flex lg:mt-0 lg:ml-1">
        <button
          type="submit"
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[6px] bg-emerald-600 px-6 text-[17px] font-medium leading-7 text-white transition-colors hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none lg:w-auto"
        >
          <Search className="size-5" strokeWidth={2} />
          Search
        </button>
      </div>
    </form>
  )
}
