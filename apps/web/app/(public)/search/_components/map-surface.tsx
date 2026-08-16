"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { Home } from "lucide-react"
import { setWorkerUrl } from "maplibre-gl"
import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  useMap,
} from "@/components/ui/map"

// MapLibre defaults to fetching its worker from unpkg.com, which the CSP blocks.
// `scripts/sync-map-worker.mjs` copies it into public/ so it loads same-origin.
if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre-gl-worker.mjs")
}

/** Falls back to the Kathmandu valley when nothing in the result set is mappable. */
const KATHMANDU = { latitude: 27.7172, longitude: 85.324 }

export type MapMarkerData = {
  slug: string
  title: string
  city: string
  image: string
  price?: string | undefined
  originalPrice?: string | undefined
  priceLabel?: string | undefined
  bedrooms?: number | undefined
  bathrooms?: number | undefined
  latitude: number
  longitude: number
}

export type MapBounds = {
  west: number
  south: number
  east: number
  north: number
}

/**
 * Reports the visible extent after each pan/zoom so the result list can narrow
 * to what is on screen. `moveend` fires once per gesture, so no debounce.
 */
function BoundsReporter({
  onBoundsChange,
}: {
  onBoundsChange: (bounds: MapBounds) => void
}) {
  const { map, isLoaded } = useMap()
  const callbackRef = useRef(onBoundsChange)

  useEffect(() => {
    callbackRef.current = onBoundsChange
  }, [onBoundsChange])

  useEffect(() => {
    if (!map || !isLoaded) return

    const report = () => {
      const bounds = map.getBounds()
      callbackRef.current({
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
      })
    }

    report()
    map.on("moveend", report)
    return () => {
      map.off("moveend", report)
    }
  }, [map, isLoaded])

  return null
}

function mapStyleUrl(): string {
  return (
    process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
    "https://tiles.openfreemap.org/styles/liberty"
  )
}

/**
 * Zillow-style result map: one price pill per listing, click to open a card.
 * The basemap comes from NEXT_PUBLIC_MAP_STYLE_URL because the app's CSP only
 * allows that one tile origin.
 */
export function MapSurface({
  markers,
  hoveredSlug,
  onHoverChange,
  onBoundsChange,
}: {
  markers: MapMarkerData[]
  hoveredSlug?: string | null
  onHoverChange?: (slug: string | null) => void
  onBoundsChange?: (bounds: MapBounds) => void
}) {
  const [openSlug, setOpenSlug] = useState<string | null>(null)

  // Centre on the results so a district filter frames its own listings. `center`
  // is a MapLibre construction option, so this only applies on first mount and
  // later re-renders never yank the map away from where the user panned.
  const centre = useMemo(() => {
    if (markers.length === 0) return KATHMANDU
    const total = markers.reduce(
      (sum, marker) => ({
        latitude: sum.latitude + marker.latitude,
        longitude: sum.longitude + marker.longitude,
      }),
      { latitude: 0, longitude: 0 },
    )
    return {
      latitude: total.latitude / markers.length,
      longitude: total.longitude / markers.length,
    }
  }, [markers])

  const style = mapStyleUrl()

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[18px] shadow-[0_1px_0_rgba(0,0,0,.04)] ring-1 ring-black/[.04]">
      <Map
        className="h-full w-full"
        styles={{ light: style, dark: style }}
        center={[centre.longitude, centre.latitude]}
        zoom={markers.length > 1 ? 11 : 13}
      >
        <MapControls />
        {onBoundsChange ? (
          <BoundsReporter onBoundsChange={onBoundsChange} />
        ) : null}

        {markers.map((marker) => {
          // A card hover reads the same as an open popup, so the pair stays legible.
          const active = openSlug === marker.slug || hoveredSlug === marker.slug
          const specs = [
            marker.bedrooms != null ? `${marker.bedrooms} bedrooms` : null,
            marker.bathrooms != null ? `${marker.bathrooms} baths` : null,
          ]
            .filter(Boolean)
            .join(" · ")
          return (
            <MapMarker
              key={marker.slug}
              longitude={marker.longitude}
              latitude={marker.latitude}
              onClick={() =>
                setOpenSlug((current) =>
                  current === marker.slug ? null : marker.slug,
                )
              }
              onMouseEnter={() => onHoverChange?.(marker.slug)}
              onMouseLeave={() => onHoverChange?.(null)}
            >
              <MarkerContent>
                {/* Reference marker: a white disc with a house glyph, inverting
                    when the paired result card is hovered. */}
                <span
                  aria-label={marker.title}
                  className={
                    active
                      ? "z-10 grid size-8 scale-110 place-items-center rounded-full border border-[#171717] bg-[#171717] text-white shadow-[0_4px_12px_rgba(0,0,0,.28)] transition"
                      : "grid size-8 place-items-center rounded-full border border-black/[.08] bg-white text-[#171717] shadow-[0_2px_8px_rgba(0,0,0,.14)] transition hover:scale-110"
                  }
                >
                  <Home
                    className={
                      active
                        ? "size-4 fill-white text-white"
                        : "size-4 fill-[#171717] text-[#171717]"
                    }
                    strokeWidth={2}
                  />
                </span>
              </MarkerContent>

              <MarkerPopup className="max-w-none rounded-2xl border-0 bg-white p-2 shadow-[0_8px_28px_rgba(0,0,0,.18)]">
                <Link
                  href={`/properties/${marker.slug}`}
                  className="block w-[268px] text-[#1d1919]"
                >
                  <span className="relative block overflow-hidden rounded-xl bg-[#f1f1ef]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={marker.image}
                      alt={marker.title}
                      className="block aspect-[4/3] w-full object-cover"
                    />
                  </span>

                  <span className="block px-1.5 pt-3 pb-1.5">
                    <span className="block truncate text-[15px] leading-normal font-medium tracking-[-0.015em]">
                      {marker.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] leading-normal text-[#737373]">
                      {marker.city}
                    </span>

                    {specs ? (
                      <span className="mt-0.5 block truncate text-[13px] leading-normal text-[#737373]">
                        {specs}
                      </span>
                    ) : null}

                    {marker.price ? (
                      <span className="mt-1.5 block text-[14px] leading-normal font-medium">
                        {marker.originalPrice ? (
                          <span className="mr-1.5 text-[12px] font-normal text-[#737373] line-through">
                            {marker.originalPrice}
                          </span>
                        ) : null}
                        {marker.price}
                        <span className="ml-1.5 text-[12px] font-normal text-[#737373]">
                          {marker.priceLabel ?? "Guide price"}
                        </span>
                      </span>
                    ) : null}
                  </span>
                </Link>
              </MarkerPopup>
            </MapMarker>
          )
        })}
      </Map>

      {markers.length === 0 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center">
          <span className="rounded-full bg-white/95 px-4 py-2 text-[12px] font-medium text-[#4a4a4a] shadow-sm">
            No mapped listings in this search yet
          </span>
        </div>
      ) : null}
    </div>
  )
}
