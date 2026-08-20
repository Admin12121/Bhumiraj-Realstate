"use client"

import Link from "next/link"
import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  CalendarClock,
  Check,
  Loader2,
  PauseCircle,
  PlayCircle,
  X,
} from "lucide-react"
import { respondToAssignment } from "@/features/listings/api/listing-payments-api"
import {
  useAgentAssignments,
  useAgentSummary,
  useSetAgentAvailability,
} from "@/features/listings/queries/use-agent-workspace"
import { queryKeys } from "@/shared/query/query-keys"
import { Button } from "@/components/ui/button"
import { errorMessage } from "@/shared/http/error-message";

function remaining(expiresAt: string | null): string | null {
  if (!expiresAt) return null
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return "Expired"
  const hours = Math.floor(ms / 3_600_000)
  if (hours >= 24) return `${Math.floor(hours / 24)}d left to respond`
  if (hours >= 1) return `${hours}h left to respond`
  return `${Math.max(1, Math.floor(ms / 60_000))}m left to respond`
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/** Caseload, plus the switch that stops new offers arriving. */
function CaseloadHeader() {
  const summary = useAgentSummary()
  const availability = useSetAgentAvailability()

  if (!summary.data?.isAgent) return null
  const { activeCases, caseloadLimit, caseloadWarnAt, availabilityStatus } =
    summary.data
  const paused = availabilityStatus === "UNAVAILABLE"
  const nearLimit = activeCases >= caseloadWarnAt

  return (
    <section className="surface rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Active caseload</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">
            {activeCases}
            <span className="text-base font-normal text-slate-400">
              {" "}
              / {caseloadLimit}
            </span>
          </p>
        </div>

        <Button
          variant="outline"
          disabled={availability.isPending}
          onClick={() =>
            availability.mutate(paused ? "AVAILABLE" : "UNAVAILABLE")
          }
        >
          {availability.isPending ? (
            <Loader2 className="animate-spin" />
          ) : paused ? (
            <PlayCircle />
          ) : (
            <PauseCircle />
          )}
          {paused ? "Start taking offers" : "Pause new offers"}
        </Button>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={
            nearLimit
              ? "h-full rounded-full bg-amber-500 transition-[width] duration-300"
              : "h-full rounded-full bg-emerald-600 transition-[width] duration-300"
          }
          style={{
            width: `${Math.min(100, (activeCases / caseloadLimit) * 100)}%`,
          }}
        />
      </div>

      {paused ? (
        <p className="mt-3 text-sm text-slate-500">
          You are paused, so the platform will not offer you new properties.
        </p>
      ) : nearLimit ? (
        <p className="mt-3 text-sm text-amber-700">
          You are close to your limit of {caseloadLimit} active properties.
        </p>
      ) : null}
    </section>
  )
}

function OfferRow({
  offer,
}: {
  offer: {
    id: string
    listingTitle: string
    listingSlug: string
    expiresAt: string | null
  }
}) {
  const queryClient = useQueryClient()
  const [declining, setDeclining] = useState(false)
  const [note, setNote] = useState("")

  const respond = useMutation({
    mutationFn: (input: { decision: "ACCEPT" | "DECLINE"; note?: string }) =>
      respondToAssignment(offer.id, input),
    onSuccess: async (result) => {
      toast.success(
        result.listingStatus === "PUBLISHED"
          ? "Accepted. The property is live on your profile."
          : "Declined and returned to the platform.",
      )
      setDeclining(false)
      setNote("")
      await queryClient.invalidateQueries({ queryKey: queryKeys.agent.all })
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  })

  const countdown = remaining(offer.expiresAt)

  return (
    <li className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={`/properties/${offer.listingSlug}`}
            className="font-medium hover:underline"
          >
            {offer.listingTitle}
          </Link>
          {countdown ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
              <CalendarClock className="size-4" />
              {countdown}
            </p>
          ) : null}
        </div>

        {declining ? null : (
          <div className="flex shrink-0 gap-2">
            <Button
              disabled={respond.isPending}
              onClick={() => respond.mutate({ decision: "ACCEPT" })}
            >
              {respond.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Check />
              )}
              Accept
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
            htmlFor={`decline-note-${offer.id}`}
          >
            Why are you declining?
          </label>
          <p className="mt-0.5 text-xs text-slate-500">
            Shared with the team so the property can be re-offered quickly.
          </p>
          <textarea
            id={`decline-note-${offer.id}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            maxLength={500}
            required
            placeholder="Outside my area, already at capacity, and so on"
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
              {respond.isPending ? <Loader2 className="animate-spin" /> : null}
              Confirm decline
            </Button>
          </div>
        </form>
      ) : null}
    </li>
  )
}

/** Offers waiting on this agent. Accepting publishes the listing under them. */
export function AgentAssignmentsPanel() {
  const summary = useAgentSummary()
  const isAgent = summary.data?.isAgent === true
  const offers = useAgentAssignments("OFFERED", isAgent)
  const accepted = useAgentAssignments("ACCEPTED", isAgent)

  if (summary.isPending) {
    return <p className="text-sm text-slate-500">Loading your workspace…</p>
  }

  if (!isAgent) {
    return (
      <section className="surface rounded-2xl p-6">
        <h2 className="text-lg font-semibold">Not an agent account</h2>
        <p className="mt-1 max-w-prose text-sm text-slate-500">
          Property offers are sent to appointed Bhumiraj agents. If you have
          been invited to become one, accept the invitation from your email
          first.
        </p>
      </section>
    )
  }

  const pending = offers.data?.items ?? []
  const active = accepted.data?.items ?? []

  return (
    <div className="space-y-6">
      <CaseloadHeader />

      <section className="surface overflow-hidden rounded-2xl">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">Waiting on you</h2>
          <p className="text-sm text-slate-500">
            Accepting publishes the property under your profile.
          </p>
        </div>

        {offers.isPending ? (
          <p className="p-6 text-sm text-slate-500">Loading offers…</p>
        ) : offers.isError ? (
          <p className="p-6 text-sm text-red-600">
            Offers could not be loaded. Refresh to try again.
          </p>
        ) : pending.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No offers waiting on you.</p>
        ) : (
          <ul className="divide-y">
            {pending.map((offer) => (
              <OfferRow key={offer.id} offer={offer} />
            ))}
          </ul>
        )}
      </section>

      <section className="surface overflow-hidden rounded-2xl">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">Your properties</h2>
          <p className="text-sm text-slate-500">
            Offers you accepted. These count towards your caseload.
          </p>
        </div>

        {accepted.isPending ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : active.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            Nothing yet. Accepted properties appear here and on your public
            profile.
          </p>
        ) : (
          <ul className="divide-y">
            {active.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <Link
                  href={`/properties/${item.listingSlug}`}
                  className="min-w-0 font-medium hover:underline"
                >
                  {item.listingTitle}
                </Link>
                <span className="shrink-0 text-sm text-slate-500">
                  Accepted {dateLabel(item.offeredAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
