"use client";

import { useEffect, useRef } from "react";
import { MapPin } from "lucide-react";
import type { MapMouseEvent } from "maplibre-gl";
import {
  NEPAL_PROVINCE_VIEW,
  districtsOfProvince,
  NEPAL_PROVINCES,
} from "@real-estate/contracts";

import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
} from "@/components/ui/combobox";
import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
  useMap,
} from "@/components/ui/map";
import { Button } from "@/components/ui/button";

const KATHMANDU: [number, number] = [85.324, 27.7172];

function mapStyleUrl(): string {
  return (
    process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
    "https://tiles.openfreemap.org/styles/liberty"
  );
}

/** Click anywhere on the map to place the pin. */
function ClickToPlace({
  onPick,
}: {
  onPick: (longitude: number, latitude: number) => void;
}) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;
    const handler = (event: MapMouseEvent) => {
      onPick(event.lngLat.lng, event.lngLat.lat);
    };
    map.on("click", handler);
    map.getCanvas().style.cursor = "crosshair";
    return () => {
      map.off("click", handler);
    };
  }, [map, isLoaded, onPick]);

  return null;
}

/** Recentres when the chosen province changes, so the pin starts nearby. */
function Recentre({ centre, zoom }: { centre: [number, number]; zoom: number }) {
  const { map, isLoaded } = useMap();
  // A ref, not state: this only records what the camera has already done.
  const applied = useRef<string | null>(null);
  const key = `${centre[0]},${centre[1]},${zoom}`;

  useEffect(() => {
    if (!map || !isLoaded || applied.current === key) return;
    applied.current = key;
    map.flyTo({ center: centre, zoom, duration: 800, essential: true });
  }, [map, isLoaded, centre, zoom, key]);

  return null;
}

/**
 * Province and district are picked from the real administrative list, and the
 * exact point is placed on a map.
 */
export function LocationPicker({
  province,
  district,
  latitude,
  longitude,
  onProvinceChange,
  onDistrictChange,
  onPointChange,
  mismatch,
}: {
  province: string;
  district: string;
  latitude: string;
  longitude: string;
  onProvinceChange: (value: string) => void;
  onDistrictChange: (value: string) => void;
  onPointChange: (latitude: string, longitude: string) => void;
  /** Set when the pin falls outside the chosen district. */
  mismatch?: string | null;
}) {
  const provinces = NEPAL_PROVINCES.map((entry) => entry.name);
  const districts = districtsOfProvince(province);

  const view = NEPAL_PROVINCE_VIEW[province as keyof typeof NEPAL_PROVINCE_VIEW];
  // Keyed on the chosen district only. Following the pin instead would recentre
  // the map under the cursor after every click, so placing a pin precisely
  // meant fighting the camera.
  const centre: [number, number] = view
    ? [view.longitude, view.latitude]
    : KATHMANDU;
  const zoom = view ? 12 : 7;

  const hasPoint = Boolean(latitude && longitude);
  const mapStyle = mapStyleUrl();

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Combobox
          items={provinces}
          value={province}
          onValueChange={(value) => {
            const next = String(value ?? "");
            onProvinceChange(next);
            // The old district almost never belongs to the new province.
            const first = districtsOfProvince(next)[0] ?? "";
            onDistrictChange(first);
          }}
        >
          <ComboboxInput placeholder="Search provinces…" aria-label="Province" />
          <ComboboxPopup>
            <ComboboxEmpty>No province matches.</ComboboxEmpty>
            <ComboboxList>
              {(item: string) => (
                <ComboboxItem key={item} value={item}>
                  {item}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxPopup>
        </Combobox>

        <Combobox
          items={districts as string[]}
          value={district}
          onValueChange={(value) => onDistrictChange(String(value ?? ""))}
        >
          <ComboboxInput placeholder="Search districts…" aria-label="District" />
          <ComboboxPopup>
            <ComboboxEmpty>No district matches.</ComboboxEmpty>
            <ComboboxList>
              {(item: string) => (
                <ComboboxItem key={item} value={item}>
                  {item}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxPopup>
        </Combobox>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <div className="h-[320px] w-full">
          <Map
            className="h-full w-full"
            styles={{ light: mapStyle, dark: mapStyle }}
            center={centre}
            zoom={zoom}
          >
            <MapControls />
            <Recentre centre={centre} zoom={zoom} />
            <ClickToPlace
              onPick={(lng, lat) =>
                onPointChange(lat.toFixed(6), lng.toFixed(6))
              }
            />
            {hasPoint ? (
              <MapMarker
                longitude={Number(longitude)}
                latitude={Number(latitude)}
              >
                {/* MarkerContent portals into MapLibre's marker element; a bare
                    child never reaches the map and leaves the pin invisible. */}
                <MarkerContent>
                  {/* The pin itself, nothing behind it: the filled circle read
                      as a button rather than a map marker. */}
                  <MapPin
                    className="size-7 -translate-y-1/2 fill-primary text-primary-foreground drop-shadow"
                    strokeWidth={1.5}
                  />
                </MarkerContent>
              </MapMarker>
            ) : null}
          </Map>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/40 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            {hasPoint
              ? `Pin placed at ${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`
              : null}
          </p>
          {hasPoint ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onPointChange("", "")}
            >
              Clear pin
            </Button>
          ) : null}
        </div>
      </div>

      {mismatch ? (
        <p className="text-destructive-foreground text-xs" role="alert">
          {mismatch}
        </p>
      ) : null}
    </div>
  );
}
