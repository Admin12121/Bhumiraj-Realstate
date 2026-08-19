"use client"

import { useEffect, useRef, useState } from "react"
import { useMap } from "@/components/ui/map"
import { districtBoundaryKey } from "@real-estate/contracts"

type Feature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>

const SOURCE_ID = "district-boundary"
const LINE_ID = "district-boundary-line"
const FILL_ID = "district-boundary-fill"
const FADE_MS = 450

const EMPTY: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
}

/**
 * The boundary file is ~2MB, so it is fetched the first time a district is
 * actually selected and then kept for the session.
 */
let boundaryCache: Promise<Map<string, Feature>> | null = null

function loadBoundaries(): Promise<Map<string, Feature>> {
  boundaryCache ??= fetch("/assets/nepal-districts.geojson")
    .then((response) => {
      if (!response.ok) throw new Error("boundaries unavailable")
      return response.json() as Promise<GeoJSON.FeatureCollection>
    })
    .then((collection) => {
      const index = new Map<string, Feature>()
      for (const feature of collection.features) {
        const name = (feature.properties?.["DISTRICT"] as string | undefined)
          ?.trim()
          .toUpperCase()
        if (name) index.set(name, feature as Feature)
      }
      return index
    })
    .catch(() => new Map<string, Feature>())
  return boundaryCache
}

function bounds(feature: Feature): [number, number, number, number] {
  let west = 180
  let south = 90
  let east = -180
  let north = -90

  const visit = (ring: GeoJSON.Position[]) => {
    for (const [lng, lat] of ring) {
      if (lng === undefined || lat === undefined) continue
      if (lng < west) west = lng
      if (lng > east) east = lng
      if (lat < south) south = lat
      if (lat > north) north = lat
    }
  }

  if (feature.geometry.type === "Polygon") {
    feature.geometry.coordinates.forEach(visit)
  } else {
    for (const polygon of feature.geometry.coordinates) polygon.forEach(visit)
  }

  return [west, south, east, north]
}

/**
 * Frames the selected district using its real boundary and traces it with a
 * dashed outline that fades in for the move and back out once it settles, so
 * the outline reads as a transition rather than permanent chrome.
 */
export function DistrictBoundary({ district }: { district: string | null }) {
  const { map, isLoaded } = useMap()
  const [feature, setFeature] = useState<Feature | null>(null)
  const lastDistrict = useRef<string | null>(null)
  const fadeOut = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clearing is a render-time correction; only the async resolve needs an
  // effect, and it sets state from a callback rather than the effect body.
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  if (!district && feature !== null) {
    setFeature(null)
    setLoadedFor(null)
  }

  useEffect(() => {
    if (!district || loadedFor === district) return
    let cancelled = false
    void loadBoundaries().then((index) => {
      if (cancelled) return
      setFeature(index.get(districtBoundaryKey(district)) ?? null)
      setLoadedFor(district)
    })
    return () => {
      cancelled = true
    }
  }, [district, loadedFor])

  useEffect(() => {
    if (!map || !isLoaded) return

    const ensureLayers = () => {
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, { type: "geojson", data: EMPTY })
      }
      if (!map.getLayer(FILL_ID)) {
        map.addLayer({
          id: FILL_ID,
          type: "fill",
          source: SOURCE_ID,
          paint: {
            "fill-color": "#00733d",
            "fill-opacity": 0,
            "fill-opacity-transition": { duration: FADE_MS },
          },
        })
      }
      if (!map.getLayer(LINE_ID)) {
        map.addLayer({
          id: LINE_ID,
          type: "line",
          source: SOURCE_ID,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#00733d",
            "line-width": 2,
            "line-dasharray": [2, 2],
            "line-opacity": 0,
            "line-opacity-transition": { duration: FADE_MS },
          },
        })
      }
    }

    ensureLayers()

    const source = map.getSource(SOURCE_ID) as
      | { setData: (data: GeoJSON.FeatureCollection) => void }
      | undefined
    if (!source) return

    if (fadeOut.current) {
      clearTimeout(fadeOut.current)
      fadeOut.current = null
    }

    // `feature` lags `district` while the next polygon loads. Drawing on that
    // gap is what made a change show the previous district: the effect ran with
    // the new name but the old shape, marked itself done, and then skipped the
    // real one when it arrived. Wait until the loaded shape is the current one.
    const ready = district !== null && loadedFor === district && feature !== null

    if (!ready) {
      if (district === null) {
        map.setPaintProperty(LINE_ID, "line-opacity", 0)
        map.setPaintProperty(FILL_ID, "fill-opacity", 0)
        lastDistrict.current = null
      }
      return
    }

    const key = district
    if (lastDistrict.current === key) return
    lastDistrict.current = key

    source.setData({ type: "FeatureCollection", features: [feature] })
    map.setPaintProperty(LINE_ID, "line-opacity", 0.9)
    map.setPaintProperty(FILL_ID, "fill-opacity", 0.08)

    const [west, south, east, north] = bounds(feature)
    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: 48, duration: 1_200, essential: true },
    )

    // Hold the outline through the flight, then let it fade away.
    const settle = () => {
      fadeOut.current = setTimeout(() => {
        if (!map.getLayer(LINE_ID)) return
        map.setPaintProperty(LINE_ID, "line-opacity", 0)
        map.setPaintProperty(FILL_ID, "fill-opacity", 0)
      }, 900)
    }
    map.once("moveend", settle)

    return () => {
      map.off("moveend", settle)
    }
  }, [district, feature, isLoaded, loadedFor, map])

  useEffect(
    () => () => {
      if (fadeOut.current) clearTimeout(fadeOut.current)
    },
    [],
  )

  return null
}
