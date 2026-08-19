"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { Home } from "lucide-react"
import { setWorkerUrl } from "maplibre-gl"
import type { GeoJSONSource, MapMouseEvent } from "maplibre-gl"
import { cn } from "@/lib/utils"
import { PropertyCardCarousel } from "./residence-card"
import {
  Map,
  MapControls,
  MapMarker,
  MapPopup,
  MarkerContent,
  useMap,
} from "@/components/ui/map"
import { DistrictBoundary } from "./district-boundary"

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
  area?: string | undefined
  images?: string[] | undefined
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
 * Eases the map to a coordinate when the caller changes focus — used by the
 * feed so the map follows whichever post is being read.
 */
function FocusFlyer({
  focus,
  zoom,
  flyKey,
}: {
  focus: { latitude: number; longitude: number } | null
  zoom: number
  /** Changing this forces a fly even when the coordinate repeats. */
  flyKey?: string | undefined
}) {
  const { map, isLoaded } = useMap()
  const lastKey = useRef<string | null>(null)

  useEffect(() => {
    if (!map || !isLoaded || !focus) return

    const key = `${flyKey ?? ""}:${focus.latitude},${focus.longitude}`
    if (lastKey.current === key) return
    lastKey.current = key

    // flyTo arcs out and back in, which reads far better than a linear pan for
    // the long hops between valleys; `essential` keeps it under reduced-motion.
    map.flyTo({
      center: [focus.longitude, focus.latitude],
      zoom,
      speed: 1.1,
      curve: 1.42,
      essential: true,
    })
  }, [flyKey, focus, isLoaded, map, zoom])

  return null
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



/** White disc with a house glyph, drawn once and uploaded to the GL context. */
const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 36 36">
<circle cx="18" cy="18" r="15" fill="#fff" stroke="rgba(0,0,0,.10)"/>
<path d="M18 10.5 26 17v8.2a1.3 1.3 0 0 1-1.3 1.3h-4.4v-5.3h-4.6v5.3h-4.4A1.3 1.3 0 0 1 10 25.2V17z" fill="#171717"/>
</svg>`

/**
 * Clustered property pins drawn entirely on the GPU: a symbol layer for single
 * properties so they keep the house icon, and circle + count layers for blobs.
 * Nothing here creates DOM per property, so it holds thousands of points.
 */
function PropertyClusterLayer({
  data,
  onPointClick,
}: {
  data: GeoJSON.FeatureCollection<GeoJSON.Point, { slug: string }>
  onPointClick: (slug: string, coordinates: [number, number]) => void
}) {
  const { map, isLoaded } = useMap()
  const clickRef = useRef(onPointClick)
  const SOURCE = "properties"

  useEffect(() => {
    clickRef.current = onPointClick
  }, [onPointClick])

  useEffect(() => {
    if (!map || !isLoaded) return
    let cancelled = false

    const image = new Image(72, 72)
    image.onload = () => {
      if (cancelled || !map.getStyle()) return
      if (!map.hasImage("property-pin")) map.addImage("property-pin", image)

      if (!map.getSource(SOURCE)) {
        map.addSource(SOURCE, {
          type: "geojson",
          data,
          cluster: true,
          clusterMaxZoom: 13,
          clusterRadius: 55,
        })

        map.addLayer({
          id: "property-clusters",
          type: "circle",
          source: SOURCE,
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#171717",
            "circle-opacity": 0.92,
            "circle-stroke-width": 3,
            "circle-stroke-color": "rgba(255,255,255,.85)",
            "circle-radius": [
              "step",
              ["get", "point_count"],
              18,
              10,
              23,
              50,
              29,
            ],
          },
        })

        map.addLayer({
          id: "property-cluster-count",
          type: "symbol",
          source: SOURCE,
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-size": 13,
            "text-font": ["Noto Sans Bold"],
            "text-allow-overlap": true,
          },
          paint: { "text-color": "#fff" },
        })

        map.addLayer({
          id: "property-points",
          type: "symbol",
          source: SOURCE,
          filter: ["!", ["has", "point_count"]],
          layout: {
            "icon-image": "property-pin",
            "icon-size": 0.5,
            "icon-allow-overlap": true,
          },
        })
      }
    }
    image.src = `data:image/svg+xml;base64,${btoa(PIN_SVG)}`

    const onClusterClick = (event: MapMouseEvent) => {
      const feature = map.queryRenderedFeatures(event.point, {
        layers: ["property-clusters"],
      })[0]
      if (!feature) return
      const source = map.getSource(SOURCE) as GeoJSONSource
      void source
        .getClusterExpansionZoom(feature.properties?.cluster_id as number)
        .then((zoom) => {
          map.easeTo({
            center: (feature.geometry as GeoJSON.Point).coordinates as [
              number,
              number,
            ],
            zoom,
            duration: 500,
          })
        })
    }

    const onPointHit = (event: MapMouseEvent) => {
      const feature = map.queryRenderedFeatures(event.point, {
        layers: ["property-points"],
      })[0]
      if (!feature) return
      clickRef.current(
        feature.properties?.slug as string,
        (feature.geometry as GeoJSON.Point).coordinates as [number, number],
      )
    }

    const pointer = (cursor: string) => () => {
      map.getCanvas().style.cursor = cursor
    }

    map.on("click", "property-clusters", onClusterClick)
    map.on("click", "property-points", onPointHit)
    map.on("mouseenter", "property-clusters", pointer("pointer"))
    map.on("mouseleave", "property-clusters", pointer(""))
    map.on("mouseenter", "property-points", pointer("pointer"))
    map.on("mouseleave", "property-points", pointer(""))

    return () => {
      cancelled = true
      map.off("click", "property-clusters", onClusterClick)
      map.off("click", "property-points", onPointHit)
    }
  }, [data, isLoaded, map])

  // Marker changes only push new data through the existing source.
  useEffect(() => {
    if (!map || !isLoaded) return
    const source = map.getSource(SOURCE) as GeoJSONSource | undefined
    source?.setData(data)
  }, [data, isLoaded, map])

  return null
}

/** Popup card. Location is omitted — the pin already answers "where". */
function PropertyPopupCard({ marker }: { marker: MapMarkerData }) {
  return (
    <Link
      href={`/properties/${marker.slug}`}
      className="block w-[248px] text-[#1d1919]"
    >
      <span className="block overflow-hidden rounded-xl">
        <PropertyCardCarousel
          href={`/properties/${marker.slug}`}
          images={marker.images ?? [marker.image]}
          fallbackImage={marker.image}
          alt={marker.title}
          aspectRatio="4 / 3"
          className="bg-[#f1f1ef]"
        />
      </span>

      <span className="block px-1.5 pt-2.5 pb-1">
        <span className="block truncate text-[15px] leading-normal font-medium tracking-[-0.015em]">
          {marker.title}
        </span>
        <span className="mt-1 flex items-baseline justify-between gap-3">
          {marker.area ? (
            <span className="truncate text-[13px] leading-normal text-[#737373]">
              {marker.area}
            </span>
          ) : (
            <span />
          )}
          {marker.price ? (
            <span className="shrink-0 text-[14px] leading-normal font-medium">
              {marker.price}
            </span>
          ) : null}
        </span>
      </span>
    </Link>
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
  focusSlug,
  focusZoom = 14,
  region,
  showPopup = true,
  district,
  className,
}: {
  markers: MapMarkerData[]
  hoveredSlug?: string | null
  onHoverChange?: (slug: string | null) => void
  onBoundsChange?: (bounds: MapBounds) => void
  /** Slug the map should ease to; the feed sets this from scroll position. */
  focusSlug?: string | null
  focusZoom?: number
  /** A property page already shows the listing, so its map suppresses the card. */
  showPopup?: boolean
  /** Traced and framed when the filter selects one. */
  district?: string | null | undefined
  /** A filter selection to frame, e.g. the province or district just chosen. */
  region?:
    | { key: string; latitude: number; longitude: number; zoom: number }
    | null
    | undefined
  className?: string
}) {
  const [open, setOpen] = useState<{
    marker: MapMarkerData
    coordinates: [number, number]
  } | null>(null)

  // Rebuilt only when the marker set changes; MapLibre diffs the source itself.
  const featureCollection = useMemo<
    GeoJSON.FeatureCollection<GeoJSON.Point, { slug: string }>
  >(
    () => ({
      type: "FeatureCollection",
      features: markers.map((marker) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [marker.longitude, marker.latitude],
        },
        properties: { slug: marker.slug },
      })),
    }),
    [markers],
  )

  // Centre on the results so a district filter frames its own listings. `center`
  // is a MapLibre construction option, so this only applies on first mount and
  // later re-renders never yank the map away from where the user panned.
  const centre = useMemo(() => {
    // A region chosen before the map mounts should frame it from the first
    // paint, rather than relying on the fly-in that follows style load.
    if (region) return { latitude: region.latitude, longitude: region.longitude }
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
  }, [markers, region])

  const hovered = useMemo(
    () => markers.find((marker) => marker.slug === hoveredSlug) ?? null,
    [hoveredSlug, markers],
  )

  const style = mapStyleUrl()

  const focus = useMemo(() => {
    if (!focusSlug) return null
    const marker = markers.find((item) => item.slug === focusSlug)
    return marker
      ? { latitude: marker.latitude, longitude: marker.longitude }
      : null
  }, [focusSlug, markers])

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden rounded-[18px] shadow-[0_1px_0_rgba(0,0,0,.04)] ring-1 ring-black/[.04]",
        className,
      )}
    >
      <Map
        className="h-full w-full"
        styles={{ light: style, dark: style }}
        center={[centre.longitude, centre.latitude]}
        zoom={region ? region.zoom : markers.length > 1 ? 11 : 13}
      >
        <MapControls />
        <DistrictBoundary district={district ?? null} />
        {onBoundsChange ? (
          <BoundsReporter onBoundsChange={onBoundsChange} />
        ) : null}
        {/* A hovered card wins over the region, so reading the list never
            fights the camera. */}
        {focus ? (
          <FocusFlyer focus={focus} zoom={focusZoom} />
        ) : region ? (
          <FocusFlyer
            focus={{ latitude: region.latitude, longitude: region.longitude }}
            zoom={region.zoom}
            flyKey={region.key}
          />
        ) : null}

        {/* One GeoJSON source clustered in a worker, rather than a DOM node per
            property. This is what lets the map hold thousands of pins: nearby
            points merge into a counted blob and split apart as you zoom in. */}
        <PropertyClusterLayer
          data={featureCollection}
          onPointClick={(slug, coordinates) => {
            if (!showPopup) return
            const found = markers.find((item) => item.slug === slug)
            if (found) setOpen({ marker: found, coordinates })
          }}
        />

        {/* Exactly one DOM marker: the property the list is hovering. Keeps the
            card/map pairing without putting a node on the page per listing. */}
        {hovered ? (
          <MapMarker
            longitude={hovered.longitude}
            latitude={hovered.latitude}
            onMouseEnter={() => onHoverChange?.(hovered.slug)}
            onMouseLeave={() => onHoverChange?.(null)}
          >
            <MarkerContent>
              <span
                aria-label={hovered.title}
                className="z-10 grid size-9 scale-110 place-items-center rounded-full border border-[#171717] bg-[#171717] text-white shadow-[0_4px_12px_rgba(0,0,0,.28)]"
              >
                <Home className="size-4 fill-white text-white" strokeWidth={2} />
              </span>
            </MarkerContent>
          </MapMarker>
        ) : null}

        {open && showPopup ? (
          <MapPopup
            longitude={open.coordinates[0]}
            latitude={open.coordinates[1]}
            offset={18}
            onClose={() => setOpen(null)}
            className="max-w-none rounded-2xl border-0 bg-white p-2 shadow-[0_8px_28px_rgba(0,0,0,.18)]"
          >
            <PropertyPopupCard marker={open.marker} />
          </MapPopup>
        ) : null}
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
