"use client"

import { useState } from "react"
import { ImageOff } from "lucide-react"
import { PhotoLightbox } from "@/app/_components/photo-lightbox"
import { PropertyCardCarousel } from "@/app/_components/property-card-carousel"

const imageShadow =
  "shadow-[0_8px_16px_-4px_rgba(0,0,0,0.10),0_4px_8px_-2px_rgba(0,0,0,0.10)]"

function EmptyTile({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-lg bg-[#f1f1ef] ${className}`}
      aria-hidden="true"
    />
  )
}

/** Reference gallery: mobile snap rail, desktop 7fr/5fr lead plus 2×2 grid. */
export function StayGallery({
  photos,
  title,
}: {
  photos: string[]
  title: string
}) {
  const [open, setOpen] = useState(false)

  // A listing with no photos gets an honest placeholder. Repeating the few it
  // does have would pad the grid at the cost of implying more of the property
  // was photographed than actually was.
  if (photos.length === 0) {
    return (
      <div id="section-photos" className="-mx-5 mt-3 mb-6 lg:mx-0">
        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-[#f1f1ef] text-[#8a8a8a] lg:aspect-[16/7] lg:rounded-lg">
          <ImageOff className="size-7" strokeWidth={1.6} />
          <p className="text-[15px] font-medium">No photos yet</p>
          <p className="max-w-[34ch] text-center text-[13px] leading-5">
            Ask the agent for photos, or arrange a viewing to see the property
            in person.
          </p>
        </div>
      </div>
    )
  }

  const lead = photos[0]!
  const tiles = photos.slice(1, 5)

  return (
    <>
      <div id="section-photos">
        {/* Mobile uses the same swipeable card carousel as the feed posts, so
            the gallery reads consistently across the product. */}
        <div className="-mx-5 mt-3 mb-6 lg:hidden">
          <PropertyCardCarousel
            href="#section-photos"
            images={photos}
            fallbackImage={lead}
            alt={title}
            aspectRatio="4 / 3"
            className="bg-[#f1f1ef]"
            topRight={
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="mt-3 mr-3 inline-flex h-8 items-center rounded-full bg-black/55 px-3 text-[12px] font-medium text-white backdrop-blur-md"
              >
                View all {photos.length}
              </button>
            }
          />
        </div>

        <div className="relative mb-6 hidden w-full grid-cols-[7fr_5fr] gap-2 lg:grid 2xl:grid-cols-[6fr_4fr]">
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={`View all ${photos.length} photos`}
              className="h-full w-full"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lead}
                alt={`${title} photo 1`}
                className={`absolute inset-0 h-full w-full rounded-lg object-cover ${imageShadow}`}
              />
            </button>
          </div>

          <div className="relative grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }, (_, index) => {
              const photo = tiles[index]
              if (!photo) {
                return (
                  <EmptyTile key={`empty-${index}`} className="aspect-square" />
                )
              }
              return (
                <button
                  key={photo}
                  type="button"
                  onClick={() => setOpen(true)}
                  aria-label={`View all ${photos.length} photos`}
                  className="relative aspect-square"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo}
                    alt={`${title} photo ${index + 2}`}
                    className={`absolute inset-0 h-full w-full rounded-lg object-cover ${imageShadow}`}
                  />
                </button>
              )
            })}

            <span className="pointer-events-none absolute right-4 bottom-4 z-10">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="pointer-events-auto inline-flex h-10 items-center rounded-full bg-white px-4 text-[14px] font-medium text-[#202020] shadow-[0_2px_8px_rgba(0,0,0,.18)]"
              >
                Show all photos
              </button>
            </span>
          </div>
        </div>
      </div>

      <PhotoLightbox
        photos={photos}
        title={title}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
