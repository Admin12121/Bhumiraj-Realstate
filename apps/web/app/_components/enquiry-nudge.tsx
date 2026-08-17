"use client"

import { useEffect, useState } from "react"
import { CalendarDays, MessageCircle, Phone, X } from "lucide-react"

type Nudge = "contact" | "viewing"

/**
 * After a browsing pause, opens a small prompt and highlights exactly one of the
 * two enquiry actions. Which one is chosen varies per visit so the page does not
 * always push the same thing, and both never light up at once.
 */
export function EnquiryNudge({
  agentName,
  onHighlight,
  delayMs = 18_000,
}: {
  agentName: string
  /** Lets the page ring the matching CTA while the prompt is open. */
  onHighlight?: (nudge: Nudge | null) => void
  delayMs?: number
}) {
  const [open, setOpen] = useState(false)
  const [nudge, setNudge] = useState<Nudge | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (dismissed) return

    const timer = window.setTimeout(() => {
      // Chosen at fire time so a reload does not always show the same prompt.
      const choice: Nudge = Math.random() < 0.5 ? "contact" : "viewing"
      setNudge(choice)
      setOpen(true)
      onHighlight?.(choice)
    }, delayMs)

    return () => window.clearTimeout(timer)
  }, [delayMs, dismissed, onHighlight])

  useEffect(() => {
    if (!open) return
    // The highlight is a prompt, not a permanent state.
    const timer = window.setTimeout(() => onHighlight?.(null), 8_000)
    return () => window.clearTimeout(timer)
  }, [onHighlight, open])

  function close() {
    setOpen(false)
    setDismissed(true)
    onHighlight?.(null)
  }

  if (!open || !nudge) return null

  const copy =
    nudge === "contact"
      ? {
          icon: Phone,
          title: `Questions about this property?`,
          body: `${agentName} can answer them and share the ownership papers.`,
          action: "Contact agent",
        }
      : {
          icon: CalendarDays,
          title: "Want to see it in person?",
          body: `${agentName} can arrange a viewing at a time that suits you.`,
          action: "Book a viewing",
        }
  const Icon = copy.icon

  return (
    <div
      role="dialog"
      aria-label={copy.title}
      className="fixed right-4 bottom-24 z-50 w-[min(320px,calc(100vw-2rem))] rounded-2xl bg-white p-4 shadow-[0_8px_28px_rgba(0,0,0,.18)] [animation:chat-open_.28s_ease-out] lg:bottom-6"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-50">
          <MessageCircle className="size-4 text-emerald-800" strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] leading-5 font-[550] text-[#202020]">
            {copy.title}
          </p>
          <p className="mt-1 text-[13px] leading-5 text-[#636363]">{copy.body}</p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Dismiss"
          className="grid size-7 shrink-0 place-items-center rounded-full text-[#8a8a8a] transition-colors hover:bg-black/[.05]"
        >
          <X className="size-4" strokeWidth={1.9} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          document
            .getElementById("property-booking")
            ?.scrollIntoView({ behavior: "smooth", block: "center" })
          close()
        }}
        className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#00733d] px-4 text-[14px] font-[550] text-white transition-colors hover:bg-[#005a2e]"
      >
        <Icon className="size-4" strokeWidth={1.9} />
        {copy.action}
      </button>
    </div>
  )
}
