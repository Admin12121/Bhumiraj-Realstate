"use client"

import Image from "next/image"
import { useState } from "react"
import { Images } from "lucide-react"
import {
  Dialog,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

type Photo = { id: string; url: string; altText: string | null }

const SHADOW = "shadow-[0_1px_2px_rgba(0,0,0,.08)]"

/**
 * The reference gallery: one lead image beside a 2x2 grid at desktop, a single
 * image on small screens, and every tile opening the full set.
 */
export function PropertyGallery({
  photos,
  title,
}: {
  photos: Photo[]
  title: string
}) {
  const [open, setOpen] = useState(false)
  if (photos.length === 0) {
    return (
      <div className="mb-6 grid h-[320px] place-items-center rounded-lg bg-[#f2f2f0] text-[14px] text-[#737373]">
        No photos yet
      </div>
    )
  }

  const [lead, ...rest] = photos
  const tiles = rest.slice(0, 4)

  return (
    <>
      <div className="relative mb-6">
        <div className="grid gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="relative aspect-[3/2] w-full"
          >
            <Image
              src={lead!.url}
              alt={lead!.altText || title}
              fill
              sizes="100vw"
              className={`rounded-lg object-cover ${SHADOW}`}
            />
          </button>
        </div>

        <div className="hidden w-full grid-cols-[7fr_5fr] gap-2 lg:grid 2xl:grid-cols-[6fr_4fr]">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="relative aspect-[4/3]"
          >
            <Image
              src={lead!.url}
              alt={lead!.altText || title}
              fill
              sizes="50vw"
              priority
              className={`rounded-lg object-cover ${SHADOW}`}
            />
          </button>

          <div className="grid grid-cols-2 gap-2">
            {tiles.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setOpen(true)}
                className="relative aspect-square"
              >
                <Image
                  src={photo.url}
                  alt={photo.altText || `${title} photo ${index + 2}`}
                  fill
                  sizes="25vw"
                  className={`rounded-lg object-cover ${SHADOW}`}
                />
              </button>
            ))}
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="absolute right-4 bottom-4 bg-white"
          onClick={() => setOpen(true)}
        >
          <Images className="size-4" />
          Show all {photos.length} photos
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup className="max-h-[90vh] w-[min(1100px,calc(100vw-32px))]">
          <DialogPanel>
            <DialogTitle>{title}</DialogTitle>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {photos.map((photo, index) => (
                <div key={photo.id} className="relative aspect-[3/2]">
                  <Image
                    src={photo.url}
                    alt={photo.altText || `${title} photo ${index + 1}`}
                    fill
                    sizes="(min-width: 640px) 50vw, 100vw"
                    className="rounded-lg object-cover"
                  />
                </div>
              ))}
            </div>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </>
  )
}
