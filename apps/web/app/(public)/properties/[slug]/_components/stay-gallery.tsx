"use client"

import { useState } from "react"
import { Play } from "lucide-react"
import {
  Dialog,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog"

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
        <div className="relative mt-5 mb-9 lg:hidden">
          <div className="-m-5 w-screen snap-x snap-mandatory overflow-x-auto scroll-smooth overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-fit items-start gap-2 px-5">
              {slots.map((src, index) => {
                const isLast = index === 4
                return (
                  <div
                    key={`${src}-${index}`}
                    className="relative my-4 h-[112vw] max-h-[55vh] w-[89vw] shrink-0 snap-start"
                  >
                    <button
                      type="button"
                      aria-label={
                        isLast
                          ? `View all ${photos.length} photos`
                          : `Open image gallery: ${title} photo ${index + 1}`
                      }
                      onClick={() => setOpen(true)}
                      className="h-full w-full border-none bg-transparent p-0"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={`${title} photo ${index + 1}`}
                        className="h-full w-full rounded-xl object-cover shadow-[0_4px_8px_0px_rgba(0,0,0,0.16)]"
                      />
                      {isLast && (
                        <>
                          <div className="absolute inset-0 z-10 rounded-xl bg-black/50" />
                          <div className="absolute inset-0 z-20 flex items-center justify-center">
                            <span className="inline-flex h-10 items-center rounded-full bg-white px-4 text-[14px] font-medium text-[#202020]">
                              View all {photos.length} photos
                            </span>
                          </div>
                        </>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-8 left-[calc(89vw-1rem)] z-10 -translate-x-full">
            <span className="inline-flex h-7 items-center rounded-full bg-white px-2 text-[14px] font-medium text-[#202020] shadow-sm">
              <span className="px-1">1/{photos.length}</span>
            </span>
          </div>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup className="max-h-[90vh] w-[min(1100px,calc(100vw-32px))]">
          <DialogPanel>
            <DialogTitle>{title}</DialogTitle>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {photos.map((src, index) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${src}-${index}`}
                  src={src}
                  alt={`${title} photo ${index + 1}`}
                  className="aspect-[3/2] w-full rounded-lg object-cover"
                />
              ))}
            </div>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </>
  )
}
