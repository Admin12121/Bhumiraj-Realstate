"use client"

import { useState } from "react"
import { PhotoLightbox } from "@/app/_components/photo-lightbox"
import { PropertyCardCarousel } from "@/app/_components/residence-card"
import { Play } from "lucide-react"

const imageShadow =
  "shadow-[0_8px_16px_-4px_rgba(0,0,0,0.10),0_4px_8px_-2px_rgba(0,0,0,0.10)]"

/** Reference gallery: mobile snap rail, desktop 7fr/5fr lead plus 2×2 grid. */
export function StayGallery({
  photos,
  title,
}: {
  photos: string[]
  title: string
}) {
  const [open, setOpen] = useState(false)
  const slots = Array.from({ length: 5 }, (_, index) => photos[index % photos.length]!)

  return (
    <>
      <div id="section-photos">
        {/* Mobile uses the same swipeable card carousel as the feed posts, so
            the gallery reads consistently across the product. */}
        <div className="-mx-5 mt-3 mb-6 lg:hidden">
          <PropertyCardCarousel
            href={`#`}
            images={photos}
            fallbackImage={photos[0] ?? "/images/featured-1.webp"}
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
              className="h-full w-full"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slots[0]}
                alt={`${title} photo 1`}
                className={`absolute inset-0 h-full w-full rounded-lg object-cover ${imageShadow}`}
              />
            </button>
          </div>

          <div className="relative grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="relative aspect-square"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slots[1]}
                alt={`${title} photo 2`}
                className={`absolute inset-0 h-full w-full rounded-lg object-cover ${imageShadow}`}
              />
            </button>

            <button
              type="button"
              onClick={() => setOpen(true)}
              className="relative isolate aspect-square"
            >
              <div
                className={`relative h-full w-full overflow-hidden rounded-lg ${imageShadow}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slots[2]}
                  alt={`${title} tour video`}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/70" />
                <div className="absolute inset-x-4 bottom-4 flex items-center justify-between text-white">
                  <p className="text-[14px] leading-[17px] font-medium">
                    Watch the tour
                  </p>
                  <span className="grid size-10 place-items-center rounded-full bg-white text-black">
                    <Play className="ml-0.5 size-4 fill-current" strokeWidth={1.5} />
                  </span>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setOpen(true)}
              className="relative aspect-square"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slots[3]}
                alt={`${title} photo 4`}
                className={`absolute inset-0 h-full w-full rounded-lg object-cover ${imageShadow}`}
              />
            </button>

            <button
              type="button"
              onClick={() => setOpen(true)}
              className="relative aspect-square"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slots[4]}
                alt={`${title} photo 5`}
                className={`absolute inset-0 h-full w-full rounded-lg object-cover ${imageShadow}`}
              />
            </button>

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
