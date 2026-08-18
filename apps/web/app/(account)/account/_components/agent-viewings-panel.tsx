"use client"

import Link from "next/link"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CalendarClock, Check, Loader2, X } from "lucide-react"
import type { AvailabilityWindow } from "@real-estate/contracts"
import {
  getAgentAvailability,
  getAgentViewings,
  respondToViewing,
  setAgentAvailability,
} from "@/features/viewings/api/viewings-api"
import { useAgentSummary } from "@/features/listings/queries/use-agent-workspace"
import { Button } from "@/components/ui/button"

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

function toTimeInput(minutes: number): string {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function fromTimeInput(value: string): number {
  const [hour = "0", minute = "0"] = value.split(":")
  return Number(hour) * 60 + Number(minute)
}

/** Nepal time, spelled out so the agent knows what the hours mean. */
function slotLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Kathmandu",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

type DayState = { enabled: boolean; start: number; end: number }

const DEFAULT_DAY: DayState = { enabled: false, start: 9 * 60, end: 17 * 60 }

function AvailabilityEditor() {
  const queryClient = useQueryClient()
  const availability = useQuery({
    queryKey: ["agent", "viewings", "availability"],
    queryFn: ({ signal }) => getAgentAvailability(signal),
  })

  const [days, setDays] = useState<DayState[]>(() =>
    DAYS.map(() => ({ ...DEFAULT_DAY })),
  )
  const [seeded, setSeeded] = useState(false)

  // Seed from the saved hours exactly once. Doing it during render rather than
  // in an effect avoids a frame of empty inputs, and the `seeded` flag stops a
  // later refetch from discarding edits the agent has not saved yet.
  if (!seeded && availability.data) {
    const next = DAYS.map(() => ({ ...DEFAULT_DAY }))
    for (const window of availability.data.windows) {
      next[window.dayOfWeek] = {
        enabled: true,
        start: window.startMinute,
        end: window.endMinute,
      }
    }
    setDays(next)
    setSeeded(true)
  }

  const save = useMutation({
    mutationFn: (windows: AvailabilityWindow[]) => setAgentAvailability(windows),
    onSuccess: async () => {
      toast.success("Viewing hours saved.")
      await queryClient.invalidateQueries({ queryKey: ["agent", "viewings"] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const invalid = days.some((day) => day.enabled && day.start >= day.end)

  return (
    <section className="surface overflow-hidden rounded-2xl">
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold">Viewing hours</h2>
        <p className="text-sm text-slate-500">
          Buyers can only book inside these hours. Times are Nepal time.
        </p>
      </div>

      {availability.isPending ? (
        <p className="p-6 text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <ul className="divide-y">
            {days.map((day, index) => (
              <li
                key={DAYS[index]}
                className="flex flex-wrap items-center gap-3 p-4"
              >
                <label className="flex min-w-[150px] items-center gap-2.5 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    onChange={(event) =>
                      setDays((current) =>
                        current.map((entry, position) =>
                          position === index
                            ? { ...entry, enabled: event.target.checked }
                            : entry,
                        ),
                      )
                    }
                    className="size-4 accent-emerald-700"
                  />
                  {DAYS[index]}
                </label>

                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    step={1800}
                    value={toTimeInput(day.start)}
                    disabled={!day.enabled}
                    aria-label={`${DAYS[index]} start time`}
                    onChange={(event) =>
                      setDays((current) =>
                        current.map((entry, position) =>
                          position === index
                            ? { ...entry, start: fromTimeInput(event.target.value) }
                            : entry,
                        ),
                      )
                    }
                    className="h-10 rounded-lg border px-3 text-sm disabled:opacity-40"
                  />
                  <span className="text-sm text-slate-400">to</span>
                  <input
                    type="time"
                    step={1800}
                    value={toTimeInput(day.end)}
                    disabled={!day.enabled}
                    aria-label={`${DAYS[index]} end time`}
                    onChange={(event) =>
                      setDays((current) =>
                        current.map((entry, position) =>
                          position === index
                            ? { ...entry, end: fromTimeInput(event.target.value) }
                            : entry,
                        ),
                      )
                    }
                    className="h-10 rounded-lg border px-3 text-sm disabled:opacity-40"
                  />
                </div>

                {day.enabled && day.start >= day.end ? (
                  <span className="text-sm text-red-600">
                    End time must be after the start.
                  </span>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="flex justify-end border-t p-4">
            <Button
              disabled={save.isPending || invalid}
              onClick={() =>
                save.mutate(
                  days.flatMap((day, index) =>
                    day.enabled
                      ? [
                          {
                            dayOfWeek: index,
                            startMinute: day.start,
                            endMinute: day.end,
                          },
                        ]
                      : [],
                  ),
                )
              }
            >
              {save.isPending ? <Loader2 className="animate-spin" /> : null}
              Save hours
            </Button>
          </div>
        </>
      )}
    </section>
  )
}

function ViewingRow({
  viewing,
}: {
  viewing: {
    id: string
    listingTitle: string
    listingSlug: string
    requesterName: string
    scheduledAt: string
    notes: string | null
  }
}) {
  const queryClient = useQueryClient()
  const [declining, setDeclining] = useState(false)
  const [note, setNote] = useState("")

  const respond = useMutation({
    mutationFn: (input: { decision: "CONFIRM" | "DECLINE"; note?: string }) =>
      respondToViewing(viewing.id, input),
    onSuccess: async (result) => {
      toast.success(
        result.status === "CONFIRMED"
          ? "Viewing confirmed."
          : "Viewing declined.",
      )
      setDeclining(false)
      setNote("")
      await queryClient.invalidateQueries({ queryKey: ["agent", "viewings"] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <li className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={`/properties/${viewing.listingSlug}`}
            className="font-medium hover:underline"
          >
            {viewing.listingTitle}
          </Link>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
            <CalendarClock className="size-4" />
            {slotLabel(viewing.scheduledAt)} · {viewing.requesterName}
          </p>
          {viewing.notes ? (
            <p className="mt-1 text-sm text-slate-500">“{viewing.notes}”</p>
          ) : null}
        </div>

        {declining ? null : (
          <div className="flex shrink-0 gap-2">
            <Button
              disabled={respond.isPending}
              onClick={() => respond.mutate({ decision: "CONFIRM" })}
            >
              {respond.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Check />
              )}
              Confirm
            </Button>
            <Button
              variant="outline"
              className="text-red-600"
              disabled={respond.isPending}
              onClick={() => setDeclining(true)}
            >
              <X />
              Decline
            </Button>
          </div>
        )}
      </div>

      {declining ? (
        <form
          className="mt-3 rounded-xl bg-slate-50 p-3"
          onSubmit={(event) => {
            event.preventDefault()
            const trimmed = note.trim()
            if (trimmed) respond.mutate({ decision: "DECLINE", note: trimmed })
          }}
        >
          <label
            className="text-sm font-medium"
            htmlFor={`viewing-note-${viewing.id}`}
          >
            Why can you not make it?
          </label>
          <p className="mt-0.5 text-xs text-slate-500">
            Sent to the buyer so they can pick another time.
          </p>
          <textarea
            id={`viewing-note-${viewing.id}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            maxLength={500}
            required
            className="mt-2 w-full resize-none rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700"
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDeclining(false)
                setNote("")
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={respond.isPending || !note.trim()}
            >
              Confirm decline
            </Button>
          </div>
        </form>
      ) : null}
    </li>
  )
}

/** The agent's viewing calendar and the hours that feed it. */
export function AgentViewingsPanel() {
  const summary = useAgentSummary()
  const isAgent = summary.data?.isAgent === true

  const requested = useQuery({
    queryKey: ["agent", "viewings", "REQUESTED"],
    queryFn: ({ signal }) => getAgentViewings("REQUESTED", signal),
    enabled: isAgent,
  })
  const confirmed = useQuery({
    queryKey: ["agent", "viewings", "CONFIRMED"],
    queryFn: ({ signal }) => getAgentViewings("CONFIRMED", signal),
    enabled: isAgent,
  })

  if (summary.isPending) {
    return <p className="text-sm text-slate-500">Loading your calendar…</p>
  }

  if (!isAgent) {
    return (
      <section className="surface rounded-2xl p-6">
        <h2 className="text-lg font-semibold">Not an agent account</h2>
        <p className="mt-1 max-w-prose text-sm text-slate-500">
          Property viewings are handled by appointed Bhumiraj agents.
        </p>
      </section>
    )
  }

  const pending = requested.data?.items ?? []
  const upcoming = confirmed.data?.items ?? []

  return (
    <div className="space-y-6">
      <section className="surface overflow-hidden rounded-2xl">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">Waiting on you</h2>
          <p className="text-sm text-slate-500">
            Viewing requests from buyers.
          </p>
        </div>
        {requested.isPending ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : pending.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            No viewing requests waiting on you.
          </p>
        ) : (
          <ul className="divide-y">
            {pending.map((viewing) => (
              <ViewingRow key={viewing.id} viewing={viewing} />
            ))}
          </ul>
        )}
      </section>

      <section className="surface overflow-hidden rounded-2xl">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">Confirmed viewings</h2>
        </div>
        {upcoming.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">Nothing confirmed yet.</p>
        ) : (
          <ul className="divide-y">
            {upcoming.map((viewing) => (
              <li
                key={viewing.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <Link
                  href={`/properties/${viewing.listingSlug}`}
                  className="min-w-0 font-medium hover:underline"
                >
                  {viewing.listingTitle}
                </Link>
                <span className="shrink-0 text-sm text-slate-500">
                  {slotLabel(viewing.scheduledAt)} · {viewing.requesterName}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AvailabilityEditor />
    </div>
  )
}
