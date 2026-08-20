"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CalendarDays, Loader2, X } from "lucide-react"
import { useSession } from "@real-estate/auth/client"
import {
  getViewingSlots,
  requestViewing,
} from "@/features/viewings/api/viewings-api"
import { errorMessage } from "@/shared/http/error-message";

/**
 * Slot picker for a property viewing. Times come from the representing agent's
 * published availability, so an empty result means the agent has not opened any
 * hours rather than that something failed.
 */
export function ViewingScheduler({
  slug,
  open,
  onClose,
}: {
  slug: string
  open: boolean
  onClose: () => void
}) {
  const session = useSession()
  const queryClient = useQueryClient()
  const [selectedDay, setSelectedDay] = useState(0)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [notes, setNotes] = useState("")

  const slots = useQuery({
    queryKey: ["viewings", "slots", slug],
    queryFn: ({ signal }) => getViewingSlots(slug, 14, signal),
    enabled: open,
    staleTime: 30_000,
  })

  const book = useMutation({
    mutationFn: (startsAt: string) =>
      requestViewing(slug, {
        startsAt,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      }),
    onSuccess: async () => {
      toast.success("Viewing requested. The agent will confirm shortly.")
      setSelectedSlot(null)
      setNotes("")
      onClose()
      await queryClient.invalidateQueries({ queryKey: ["viewings"] })
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  })

  const days = useMemo(() => slots.data?.days ?? [], [slots.data])

  // A day index only means anything against the current result set, and
  // refetching after a booking can shorten it. Correcting during render keeps
  // the picker from painting an empty day for a frame.
  if (days.length > 0 && selectedDay >= days.length) {
    setSelectedDay(0)
  }

  const activeDay = days[selectedDay] ?? days[0]

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  const signedIn = Boolean(session.data)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Book a viewing"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl">
        <header className="flex items-start justify-between gap-4 border-b px-6 py-5">
          <div>
            <h2 className="text-[18px] leading-6 font-[550] text-[#202020]">
              Book a viewing
            </h2>
            <p className="mt-0.5 text-[14px] leading-5 text-[#636363]">
              {slots.data?.agent
                ? `${slots.data.agent.name} · ${slots.data.durationMinutes} minutes · Nepal time`
                : "Choose a time that suits you"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 shrink-0 place-items-center rounded-full text-[#636363] transition-colors hover:bg-black/[.05]"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {slots.isPending ? (
            <p className="text-[15px] text-[#636363]">Loading times…</p>
          ) : slots.isError ? (
            <p className="text-[15px] text-red-600">
              Viewing times could not be loaded. Try again shortly.
            </p>
          ) : !slots.data?.agent ? (
            <p className="text-[15px] leading-6 text-[#636363]">
              This property does not have an agent to show it yet. Send an
              enquiry and we will arrange one.
            </p>
          ) : days.length === 0 ? (
            <p className="text-[15px] leading-6 text-[#636363]">
              {slots.data.agent.name} has no viewing hours open in the next two
              weeks. Contact them directly to arrange a time.
            </p>
          ) : (
            <>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {days.map((day, index) => (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => {
                      setSelectedDay(index)
                      setSelectedSlot(null)
                    }}
                    className={`h-10 shrink-0 rounded-full px-4 text-[14px] font-medium transition-colors ${
                      index === selectedDay
                        ? "bg-[#171717] text-white"
                        : "bg-[#f1f1ef] text-[#202020] hover:bg-[#e8e8e5]"
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {activeDay?.slots.map((slot) => (
                  <button
                    key={slot.startsAt}
                    type="button"
                    onClick={() => setSelectedSlot(slot.startsAt)}
                    aria-pressed={selectedSlot === slot.startsAt}
                    className={`h-11 rounded-xl border text-[14px] font-medium transition-colors ${
                      selectedSlot === slot.startsAt
                        ? "border-[#00733d] bg-[#00733d]/[.06] text-[#00733d]"
                        : "border-black/[.12] text-[#202020] hover:border-black/25"
                    }`}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>

              {selectedSlot ? (
                <div className="mt-5">
                  <label
                    htmlFor="viewing-notes"
                    className="text-[14px] font-medium text-[#202020]"
                  >
                    Anything the agent should know?
                  </label>
                  <textarea
                    id="viewing-notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder="Optional"
                    className="mt-2 w-full resize-none rounded-xl border border-black/[.12] px-3 py-2.5 text-[15px] outline-none focus:border-[#00733d]"
                  />
                </div>
              ) : null}
            </>
          )}
        </div>

        {days.length > 0 && slots.data?.agent ? (
          <footer className="border-t px-6 py-4">
            {signedIn ? (
              <button
                type="button"
                disabled={!selectedSlot || book.isPending}
                onClick={() => selectedSlot && book.mutate(selectedSlot)}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#00733d] text-[16px] font-[550] text-white transition-colors hover:bg-[#005e32] disabled:opacity-45"
              >
                {book.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CalendarDays className="size-4" strokeWidth={1.9} />
                )}
                {selectedSlot ? "Request this time" : "Select a time"}
              </button>
            ) : (
              <Link
                href={`/sign-in?callbackURL=${encodeURIComponent(`/properties/${slug}`)}`}
                className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[#00733d] text-[16px] font-[550] text-white transition-colors hover:bg-[#005e32]"
              >
                Sign in to book
              </Link>
            )}
          </footer>
        ) : null}
      </div>
    </div>
  )
}
