import type { Residence } from "./residence-card"

/**
 * Sample inventory shown until real listings are published. Slugs are stable so
 * the demo detail page can be reached directly.
 */
export const DEMO_RESIDENCES: Residence[] = [
  {
    slug: "east-atelier",
    latitude: 27.7172,
    longitude: 85.324,
    image: "/images/featured-1.webp",
    images: [
      "/images/featured-1.webp",
      "/images/property-1.webp",
      "/images/bedroom-1.webp",
      "/images/property-2.webp",
    ],
    available: "Available now",
    city: "Kathmandu",
    title: "East Atelier",
    rooms: "5 bedrooms · 5 baths · 4,200 sq ft",
  },
  {
    slug: "jhamsikhel-garden",
    latitude: 27.6766,
    longitude: 85.31,
    image: "/images/featured-2.webp",
    images: [
      "/images/featured-2.webp",
      "/images/bedroom-2.webp",
      "/images/property-3.webp",
    ],
    available: "Available now",
    city: "Lalitpur",
    title: "Jhamsikhel Garden Residence",
    rooms: "4 bedrooms · 3 baths · 3,100 sq ft",
  },
  {
    slug: "lakeside-panorama",
    latitude: 28.2096,
    longitude: 83.9856,
    image: "/images/featured-3.webp",
    images: [
      "/images/featured-3.webp",
      "/images/bedroom-3.webp",
      "/images/featured-5.webp",
    ],
    available: "From next month",
    city: "Pokhara",
    title: "Lakeside Panorama House",
    rooms: "3 bedrooms · 3 baths · 2,650 sq ft",
  },
  {
    slug: "durbar-courtyard",
    latitude: 27.671,
    longitude: 85.4298,
    image: "/images/featured-4.webp",
    images: ["/images/featured-4.webp", "/images/featured-6.webp"],
    available: "Available now",
    city: "Bhaktapur",
    title: "Durbar Square Courtyard Home",
    rooms: "4 bedrooms · 2 baths · 2,900 sq ft",
  },
]

export function findDemoResidence(slug: string): Residence | undefined {
  return DEMO_RESIDENCES.find((residence) => residence.slug === slug)
}
