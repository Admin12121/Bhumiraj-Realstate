"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"

/**
 * Full-screen gallery in the Behance style: one large frame, keyboard and
 * arrow navigation, and a thumbnail strip that tracks the active photo.
 */
export function PhotoLightbox({
  photos,
  title,
  open,
  startIndex = 0,
  onClose,
}: {
  photos: string[]
  title: string
  open: boolean
  startIndex?: number
  onClose: () => void
}) {
  const [index, setIndex] = useState(startIndex)
  const stripRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number | null>(null)

  const go = useCallback(
    (direction: -1 | 1) => {
      setIndex((current) => {
        if (photos.length === 0) return current
        return (current + direction + photos.length) % photos.length
      })
    },
    [photos.length],
  )

  // Reopening starts at the caller's photo. Adjusting during render avoids a
  // frame showing the previous selection before the effect could correct it.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setIndex(startIndex)
  }

  // Escape closes, arrows move; the body must not scroll behind the overlay.
  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
      if (event.key === "ArrowRight") go(1)
      if (event.key === "ArrowLeft") go(-1)
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [go, onClose, open])

  // Keep the active thumbnail in view as the selection moves.
  useEffect(() => {
    if (!open) return
    const strip = stripRef.current
    const active = strip?.children[index] as HTMLElement | undefined
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
  }, [index, open])

  if (!open) return null

  const active = photos[index] ?? photos[0]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} photos`}
      className="fixed inset-0 z-[100] flex flex-col bg-[#0b0b0b]"
    >
      <header className="flex h-16 shrink-0 items-center justify-between px-4 text-white lg:px-6">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium">{title}</p>
          <p className="text-[13px] text-white/60">
            {index + 1} / {photos.length}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photos"
          className="grid size-10 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
        >
          <X className="size-5" strokeWidth={1.9} />
        </button>
      </header>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4 lg:px-16"
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0]?.clientX ?? null
        }}
        onTouchEnd={(event) => {
          if (touchStartX.current == null) return
          const endX = event.changedTouches[0]?.clientX ?? touchStartX.current
          const distance = endX - touchStartX.current
          touchStartX.current = null
          if (Math.abs(distance) < 42) return
          go(distance < 0 ? 1 : -1)
        }}
      >
        {photos.length > 1 ? (
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous photo"
            className="absolute left-2 z-10 hidden size-11 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 lg:grid"
          >
            <ChevronLeft className="size-6" strokeWidth={1.8} />
          </button>
        ) : null}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={active}
          alt={`${title} — photo ${index + 1}`}
          className="max-h-full max-w-full object-contain"
        />

        {photos.length > 1 ? (
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next photo"
            className="absolute right-2 z-10 hidden size-11 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 lg:grid"
          >
            <ChevronRight className="size-6" strokeWidth={1.8} />
          </button>
        ) : null}
      </div>

      {photos.length > 1 ? (
        <div
          ref={stripRef}
          className="flex shrink-0 gap-2 overflow-x-auto px-4 pb-5 [scrollbar-width:none] lg:px-6 [&::-webkit-scrollbar]:hidden"
        >
          {photos.map((photo, position) => (
            <button
              key={`${photo}-${position}`}
              type="button"
              onClick={() => setIndex(position)}
              aria-label={`Show photo ${position + 1}`}
              aria-current={position === index}
              className={`h-16 w-24 shrink-0 overflow-hidden rounded-md transition ${
                position === index
                  ? "ring-2 ring-white"
                  : "opacity-55 hover:opacity-90"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo}
                alt=""
                className="size-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
