"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Map, { Marker, NavigationControl, Popup } from "react-map-gl/maplibre";
import type { ListingCard } from "@real-estate/contracts";
import { MapPin } from "lucide-react";
import { formatMinorAmount } from "@/shared/utilities/money";

const KATHMANDU = { latitude: 27.7172, longitude: 85.324 };

type MappableListing = ListingCard & {
  location: ListingCard["location"] & {
    latitude: number;
    longitude: number;
  };
};

function isMappable(listing: ListingCard): listing is MappableListing {
  return (
    typeof listing.location.latitude === "number" &&
    typeof listing.location.longitude === "number"
  );
}

function priceLabel(listing: ListingCard): string {
  if (listing.auction) {
    return formatMinorAmount(listing.auction.currentAmountMinor, "NPR");
  }
  if (listing.price) {
    return formatMinorAmount(
      listing.price.amountMinor,
      listing.price.currency,
    );
  }
  return "View property";
}

export function ListingMap({ listings }: { listings: ListingCard[] }) {
  const points = useMemo(() => listings.filter(isMappable), [listings]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = points.find((listing) => listing.id === selectedId) ?? null;
  const center = points[0]?.location ?? KATHMANDU;

  return (
    <div className="relative h-[300px] overflow-hidden rounded-2xl bg-emerald-50">
      <Map
        key={`${center.latitude}:${center.longitude}`}
        initialViewState={{
          latitude: center.latitude,
          longitude: center.longitude,
          zoom: points.length ? 11 : 10,
        }}
        mapStyle={
          process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
          "https://tiles.openfreemap.org/styles/liberty"
        }
        attributionControl={{ compact: true }}
        reuseMaps
      >
        <NavigationControl position="bottom-right" showCompass={false} />
        {points.map((listing) => (
          <Marker
            key={listing.id}
            latitude={listing.location.latitude}
            longitude={listing.location.longitude}
            anchor="bottom"
          >
            <button
              type="button"
              aria-label={`Show ${listing.title} on map`}
              onClick={() => setSelectedId(listing.id)}
              className="rounded-full bg-emerald-800 p-1.5 text-white shadow-lg ring-2 ring-white transition hover:scale-110"
            >
              <MapPin className="size-4" />
            </button>
          </Marker>
        ))}
        {selected && (
          <Popup
            latitude={selected.location.latitude}
            longitude={selected.location.longitude}
            anchor="top"
            closeButton
            closeOnClick={false}
            onClose={() => setSelectedId(null)}
            maxWidth="240px"
          >
            <Link href={`/properties/${selected.slug}`} className="block p-1">
              <p className="line-clamp-2 text-sm font-semibold text-slate-900">
                {selected.title}
              </p>
              <p className="mt-1 text-xs font-semibold text-emerald-800">
                {priceLabel(selected)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {selected.location.locality}, {selected.location.district}
              </p>
            </Link>
          </Popup>
        )}
      </Map>
      {!points.length && (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-xl bg-white/95 p-3 text-center text-xs text-slate-600 shadow">
          Map pins appear when published properties include public coordinates.
        </div>
      )}
    </div>
  );
}
