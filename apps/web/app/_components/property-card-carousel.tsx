"use client"

import Link from "next/link"
import { useMemo, useRef, useState, type ReactNode, type TouchEvent } from "react"
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react"
import { cn } from "@/lib/utils"

/** The reference's swipeable card media: slides, arrows and a progress pill. */
/** The slide strip: a link normally, a plain box while previewing. */
function Slides({
  preview,
  href,
  className,
  alt,
  children,
}: {
  preview: boolean
  href: string
  className: string
  alt: string
  children: ReactNode
}) {
  if (preview) {
    return <div className={className}>{children}</div>
  }
  return (
    <Link href={href} className={className} aria-label={alt}>
      {children}
    </Link>
  )
}

export function PropertyCardCarousel({
  href,
  images,
  fallbackImage,
  alt,
  aspectRatio = "4 / 3.25",
  className,
  imageClassName,
  topLeft,
  topRight,
  preview = false,
}: {
  href: string
  images: string[]
  /** Only used when a real image fails to load, never to pad an empty gallery. */
  fallbackImage?: string | undefined
  alt: string
  aspectRatio?: string
  className?: string
  imageClassName?: string
  topLeft?: ReactNode
  topRight?: ReactNode
  /** Renders without navigation, for a listing that does not exist yet. */
  preview?: boolean
}) {
  const [slide, setSlide] = useState(0)
  const touchStartX = useRef<number | null>(null)

  const slides = useMemo(
    () =>
      images.filter(
        (image, index, collection) =>
          Boolean(image) && collection.indexOf(image) === index,
      ),
    [images],
  )

  const activeSlide = Math.min(slide, Math.max(0, slides.length - 1))
  const progress = slides.length
    ? ((activeSlide + 1) / slides.length) * 100
    : 100

  const move = (direction: -1 | 1) => {
    if (slides.length <= 1) return
    setSlide((current) => (current + direction + slides.length) % slides.length)
  }

  return (
    <div
      className={cn(
        "group/media relative isolate w-full overflow-hidden",
        className,
      )}
      style={{ aspectRatio }}
      onTouchStart={(event: TouchEvent<HTMLDivElement>) => {
        touchStartX.current = event.touches[0]?.clientX ?? null
      }}
      onTouchEnd={(event: TouchEvent<HTMLDivElement>) => {
        if (touchStartX.current == null || slides.length <= 1) return
        const endX = event.changedTouches[0]?.clientX ?? touchStartX.current
        const distance = endX - touchStartX.current
        touchStartX.current = null
        if (Math.abs(distance) < 42) return
        move(distance < 0 ? 1 : -1)
      }}
      data-slot="property-card-carousel"
    >
      <Slides
        preview={preview}
        href={href}
        className="absolute inset-0 z-0 block overflow-hidden"
        alt={alt}
      >
        {slides.length === 0 ? (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-[#f1f1ef] text-[#8a8a8a]">
            <ImageOff className="size-6" strokeWidth={1.6} />
            <span className="text-[12px] font-medium">No photos yet</span>
          </span>
        ) : null}
        <div
          className="flex h-full w-full transition-transform duration-[250ms] ease-out"
          style={{ transform: `translateX(-${activeSlide * 100}%)` }}
        >
          {slides.map((image, imageIndex) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${image}-${imageIndex}`}
              src={image}
              alt={imageIndex === 0 ? alt : ""}
              draggable={false}
              onError={(event) => {
                if (!fallbackImage) return
                if (event.currentTarget.dataset.fallbackApplied === "true") return
                event.currentTarget.dataset.fallbackApplied = "true"
                event.currentTarget.src = fallbackImage
              }}
              className={cn(
                "h-full w-full shrink-0 object-cover transition-transform duration-500 ease-out select-none",
                imageClassName,
              )}
            />
          ))}
        </div>
      </Slides>

      {topLeft && <div className="absolute top-0 left-0 z-20">{topLeft}</div>}
      {topRight && <div className="absolute top-0 right-0 z-20">{topRight}</div>}

      {slides.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              move(-1)
            }}
            className="absolute top-1/2 left-3 z-20 hidden size-[30px] -translate-y-1/2 place-items-center rounded-[8px] border-0 bg-black/70 p-0 text-white opacity-0 backdrop-blur-[2px] transition-[opacity,background-color,color] duration-150 hover:bg-white hover:text-black min-[65rem]:grid min-[65rem]:group-hover/media:opacity-100 min-[65rem]:focus-visible:opacity-100"
          >
            <ChevronLeft className="size-4" strokeWidth={1.8} />
          </button>

          <button
            type="button"
            aria-label="Next photo"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              move(1)
            }}
            className="absolute top-1/2 right-3 z-20 hidden size-[30px] -translate-y-1/2 place-items-center rounded-[8px] border-0 bg-black/70 p-0 text-white opacity-0 backdrop-blur-[2px] transition-[opacity,background-color,color] duration-150 hover:bg-white hover:text-black min-[65rem]:grid min-[65rem]:group-hover/media:opacity-100 min-[65rem]:focus-visible:opacity-100"
          >
            <ChevronRight className="size-4" strokeWidth={1.8} />
          </button>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-3 left-1/2 z-20 hidden w-10 -translate-x-1/2 min-[65rem]:block"
          >
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/50">
              <div
                className="h-full w-full rounded-full bg-white transition-transform duration-[250ms] ease-out"
                style={{ transform: `translateX(-${100 - progress}%)` }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
