"use client"

import { useMemo } from "react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { useSliderWithInput } from "@/hooks/use-slider-with-input"

/** Rupees, not minor units — the API conversion happens on apply. */
const PRICE_MIN = 100_000
const PRICE_MAX = 150_000_000
const TICKS = 40

export type FeedFilterState = {
  propertyType: string[]
  category: string[]
  bedrooms: string[]
  minPrice: number
  maxPrice: number
}

export const initialFeedFilters: FeedFilterState = {
  propertyType: [],
  category: [],
  bedrooms: [],
  minPrice: PRICE_MIN,
  maxPrice: PRICE_MAX,
}

/** Mirrors `propertyTypeSchema` so a selection is always a valid query value. */
const PROPERTY_TYPES = [
  { value: "LAND", label: "Land" },
  { value: "APARTMENT", label: "Flat" },
  { value: "COMMERCIAL", label: "Business" },
  { value: "HOUSE", label: "House" },
  { value: "OFFICE", label: "Office" },
  { value: "WAREHOUSE", label: "Warehouse" },
]

const CATEGORIES = [
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "SEMI_COMMERCIAL", label: "Semi-Commercial" },
  { value: "RESIDENTIAL", label: "Residential" },
]

const BEDROOMS = [
  { value: "1", label: "1+" },
  { value: "2", label: "2+" },
  { value: "3", label: "3+" },
  { value: "4", label: "4+" },
]

/** Compact NPR label: 1,00,000 → ₹1 Lakh, 15,00,00,000 → ₹15 Crore. */
function formatNpr(value: number): string {
  if (value >= 10_000_000) {
    const crore = value / 10_000_000
    return `₹${crore % 1 === 0 ? crore : crore.toFixed(1)} Crore`
  }
  if (value >= 100_000) {
    const lakh = value / 100_000
    return `₹${lakh % 1 === 0 ? lakh : lakh.toFixed(1)} Lakh`
  }
  return `₹${value.toLocaleString("en-IN")}`
}

function PriceRange({
  value,
  onApply,
}: {
  value: { minPrice: number; maxPrice: number }
  onApply: (next: { minPrice: number; maxPrice: number }) => void
}) {
  const {
    sliderValue,
    inputValues,
    handleSliderChange,
    handleInputChange,
    validateAndUpdateValue,
  } = useSliderWithInput({
    minValue: PRICE_MIN,
    maxValue: PRICE_MAX,
    initialValue: [value.minPrice, value.maxPrice],
  })

  // Deterministic jagged distribution — no Math.random, which would desync
  // between server and client render. Skewed low, where most stock sits.
  const counts = useMemo(
    () =>
      Array.from({ length: TICKS }, (_, tick) => {
        const position = tick / (TICKS - 1)
        const curve = Math.exp(-((position - 0.22) ** 2) / 0.05)
        const jitter =
          0.72 +
          0.28 * Math.abs(Math.sin(tick * 2.399)) +
          0.16 * Math.abs(Math.cos(tick * 1.117))
        return Math.max(0.06, curve * jitter)
      }),
    [],
  )
  const peak = Math.max(...counts)
  const step = (PRICE_MAX - PRICE_MIN) / TICKS
  const low = sliderValue[0] ?? PRICE_MIN
  const high = sliderValue[1] ?? PRICE_MAX

  return (
    <div className="space-y-4 border-b pb-4">
      <Label className="text-[15px]">Price</Label>

      <div>
        <div className="flex h-12 w-full items-end px-1" aria-hidden="true">
          {counts.map((count, index) => {
            const from = PRICE_MIN + index * step
            const to = from + step
            const selected = to >= low && from <= high
            return (
              <div
                key={index}
                className="flex flex-1 justify-center"
                style={{ height: `${(count / peak) * 100}%` }}
              >
                <span
                  data-selected={selected}
                  className="h-full w-full bg-primary/20 data-[selected=true]:bg-primary/70"
                />
              </div>
            )
          })}
        </div>
        <Slider
          value={sliderValue}
          onValueChange={(next) =>
            handleSliderChange(Array.isArray(next) ? [...next] : [Number(next)])
          }
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={100_000}
          aria-label="Price range"
        />
        <div className="mt-2 flex justify-between text-[12px] text-muted-foreground">
          <span>{formatNpr(low)}</span>
          <span>{formatNpr(high)}</span>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor="min-price" className="text-[12px]">
            Min price
          </Label>
          <div className="relative">
            <Input
              id="min-price"
              className="peer w-full bg-white ps-7"
              type="text"
              inputMode="numeric"
              value={inputValues[0]}
              onChange={(event) => handleInputChange(event, 0)}
              onBlur={() => validateAndUpdateValue(inputValues[0] ?? "", 0)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  validateAndUpdateValue(inputValues[0] ?? "", 0)
                }
              }}
              aria-label="Enter minimum price"
            />
            <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-sm text-muted-foreground">
              रु
            </span>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor="max-price" className="text-[12px]">
            Max price
          </Label>
          <div className="relative">
            <Input
              id="max-price"
              className="peer w-full bg-white ps-7"
              type="text"
              inputMode="numeric"
              value={inputValues[1]}
              onChange={(event) => handleInputChange(event, 1)}
              onBlur={() => validateAndUpdateValue(inputValues[1] ?? "", 1)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  validateAndUpdateValue(inputValues[1] ?? "", 1)
                }
              }}
              aria-label="Enter maximum price"
            />
            <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-sm text-muted-foreground">
              रु
            </span>
          </div>
        </div>
      </div>

      <Button
        className="w-full"
        variant="secondary"
        onClick={() => onApply({ minPrice: low, maxPrice: high })}
      >
        Apply
      </Button>
    </div>
  )
}

export function FeedFilters({
  state,
  onChange,
}: {
  state: FeedFilterState
  onChange: (next: FeedFilterState) => void
}) {
  function toggle(key: "propertyType" | "category" | "bedrooms", value: string) {
    const current = state[key]
    onChange({
      ...state,
      [key]: current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    })
  }

  /** Checkbox rows, matching the supplied filter reference. */
  function optionList(
    key: "propertyType" | "category" | "bedrooms",
    options: { value: string; label: string }[],
  ) {
    return (
      <fieldset className="flex flex-col gap-0.5">
        {options.map((option) => {
          const id = `${key}-${option.value}`
          return (
            <label
              key={option.value}
              htmlFor={id}
              className="flex cursor-pointer items-center gap-3 rounded-md px-1 py-2 transition-colors hover:bg-black/[.03]"
            >
              <Checkbox
                id={id}
                checked={state[key].includes(option.value)}
                onCheckedChange={() => toggle(key, option.value)}
              />
              <span className="text-[14px] leading-none text-foreground">
                {option.label}
              </span>
            </label>
          )
        })}
      </fieldset>
    )
  }

  const active =
    state.propertyType.length +
    state.category.length +
    state.bedrooms.length +
    (state.minPrice > PRICE_MIN || state.maxPrice < PRICE_MAX ? 1 : 0)

  return (
    <div className="h-full w-full rounded-md px-3 py-1">
      <div className="flex items-center justify-between pb-2">
        <span className="text-[15px] font-medium">Filters</span>
        {active > 0 ? (
          <button
            type="button"
            onClick={() => onChange(initialFeedFilters)}
            className="text-[13px] font-medium text-emerald-800 hover:underline"
          >
            Clear all
          </button>
        ) : null}
      </div>

      <PriceRange
        value={{ minPrice: state.minPrice, maxPrice: state.maxPrice }}
        onApply={(next) => onChange({ ...state, ...next })}
      />

      {/* Base UI opens multiple panels by default; there is no `type` prop. */}
      <Accordion className="w-full" defaultValue={["property-type", "category"]}>
        <AccordionItem value="property-type" className="py-1">
          <AccordionTrigger className="py-2 text-[15px] leading-6 hover:no-underline">
            Property Type
          </AccordionTrigger>
          <AccordionContent className="pb-2 text-muted-foreground">
            {optionList("propertyType", PROPERTY_TYPES)}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="category" className="py-1">
          <AccordionTrigger className="py-2 text-[15px] leading-6 hover:no-underline">
            Property Category
          </AccordionTrigger>
          <AccordionContent className="pb-2 text-muted-foreground">
            {optionList("category", CATEGORIES)}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="bedrooms" className="py-1">
          <AccordionTrigger className="py-2 text-[15px] leading-6 hover:no-underline">
            Bedrooms
          </AccordionTrigger>
          <AccordionContent className="pb-2 text-muted-foreground">
            {optionList("bedrooms", BEDROOMS)}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
