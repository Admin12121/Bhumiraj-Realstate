"use client"

import { useState, useSyncExternalStore } from "react"
import { Check, Copy, Mail, Share2 } from "lucide-react"

/** navigator.share availability never changes within a page load. */
function subscribeToNothing() {
  return () => {}
}

// lucide v1 dropped brand glyphs, so the recognisable marks are inlined here.
function BrandIcon({ path, className }: { path: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d={path} />
    </svg>
  )
}

const BRAND_PATHS = {
  whatsapp:
    "M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.95 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.86 1.21 3.06c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.8h-.02a9.8 9.8 0 0 1-4.99-1.37l-.36-.21-3.71.97.99-3.62-.23-.37a9.79 9.79 0 0 1-1.5-5.23c0-5.4 4.4-9.8 9.82-9.8 2.62 0 5.08 1.03 6.93 2.88a9.74 9.74 0 0 1 2.87 6.93c0 5.41-4.4 9.81-9.8 9.81M20.5 3.49A11.8 11.8 0 0 0 12.05 0C5.5 0 .18 5.32.17 11.86c0 2.09.55 4.13 1.59 5.93L.07 24l6.35-1.66a11.9 11.9 0 0 0 5.67 1.44h.01c6.55 0 11.87-5.32 11.87-11.86 0-3.17-1.23-6.15-3.47-8.39",
  facebook:
    "M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07",
  x: "M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.46l8.6-9.83L0 1.15h7.59l5.24 6.93zm-1.29 19.5h2.04L6.49 3.24H4.3z",
  linkedin:
    "M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13m1.78 13.02H3.55V9h3.57zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0",
} as const
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export type ShareDetails = {
  title: string
  /** Short line used as the message body on networks that accept one. */
  text: string
  /** Absolute path on this site; resolved against the live origin at click time. */
  path: string
}

/**
 * Share control backed by real listing data. Uses the native share sheet where
 * the browser offers one, and falls back to per-network links plus copy.
 */
export function ShareMenu({
  details,
  className,
  label = "Share",
  iconOnly = false,
}: {
  details: ShareDetails
  className?: string
  label?: string
  iconOnly?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)

  // Capability read, not state: the server snapshot is false so hydration
  // matches, then the client resolves it. Exactly one share surface renders —
  // never the native sheet and the menu together.
  const hasNativeShare = useSyncExternalStore(
    subscribeToNothing,
    () => typeof navigator !== "undefined" && !!navigator.share,
    () => false,
  )

  function shareUrl(): string {
    if (typeof window === "undefined") return details.path
    return new URL(details.path, window.location.origin).toString()
  }

  async function openNativeSheet() {
    try {
      await navigator.share({
        title: details.title,
        text: details.text,
        url: shareUrl(),
      })
    } catch {
      // A dismissed sheet is not an error worth surfacing.
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl())
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const url = typeof window === "undefined" ? "" : shareUrl()
  const encodedUrl = encodeURIComponent(url)
  const encodedText = encodeURIComponent(`${details.title} — ${details.text}`)

  const networks = [
    {
      label: "WhatsApp",
      brand: BRAND_PATHS.whatsapp,
      href: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
    },
    {
      label: "Facebook",
      brand: BRAND_PATHS.facebook,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      label: "X",
      brand: BRAND_PATHS.x,
      href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    },
    {
      label: "LinkedIn",
      brand: BRAND_PATHS.linkedin,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    { label: "Email", brand: null, href: `mailto:?subject=${encodeURIComponent(details.title)}&body=${encodedText}%20${encodedUrl}` },
  ]

  if (hasNativeShare) {
    return (
      <button
        type="button"
        aria-label={`Share ${details.title}`}
        onClick={() => void openNativeSheet()}
        className={className}
      >
        <Share2 className="size-4" />
        {iconOnly ? null : label}
      </button>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`Share ${details.title}`}
            className={className}
          />
        }
      >
        <Share2 className="size-4" />
        {iconOnly ? null : label}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[280px] rounded-xl border border-black/[.08] bg-white p-2 shadow-[0_2px_16px_rgba(0,0,0,.12)]"
      >
        <p className="px-2 pt-1 pb-2 text-[13px] font-medium text-[#202020]">
          Share this property
        </p>

        <div className="flex flex-col">
          {networks.map((network) => (
            <a
              key={network.label}
              href={network.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-[14px] text-[#202020] transition-colors hover:bg-black/[.04]"
            >
              {network.brand ? (
                <BrandIcon
                  path={network.brand}
                  className="size-4 shrink-0 text-[#636363]"
                />
              ) : (
                <Mail
                  className="size-4 shrink-0 text-[#636363]"
                  strokeWidth={1.8}
                />
              )}
              {network.label}
            </a>
          ))}

          <button
            type="button"
            onClick={copyLink}
            className="mt-1 flex items-center gap-3 rounded-lg border-t px-2 py-2.5 text-[14px] text-[#202020] transition-colors hover:bg-black/[.04]"
          >
            {copied ? (
              <Check className="size-4 shrink-0 text-emerald-700" strokeWidth={2} />
            ) : (
              <Copy className="size-4 shrink-0 text-[#636363]" strokeWidth={1.8} />
            )}
            {copied ? "Link copied" : "Copy link"}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
