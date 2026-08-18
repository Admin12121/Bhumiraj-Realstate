"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { AlertTriangle, BadgeCheck, Check, X } from "lucide-react"
import { AGENT_CASELOAD_WARN_AT } from "@real-estate/contracts"
import {
  assignListing,
  getAssignableAgents,
  getPaymentProofs,
  reviewPaymentProof,
} from "@/features/listings/api/listing-payments-api"
import { formatMinorAmount } from "@/shared/utilities/money"
import { useHasStaffPermission } from "./admin-shell"

const STATUSES = ["SUBMITTED", "APPROVED", "REJECTED"] as const

/**
 * Payment verification queue. Approving moves a listing to AWAITING_AGENT; the
 * agent picker then offers it, refusing any agent already at the hard limit.
 */
export function PaymentVerificationPanel() {
  const canReview = useHasStaffPermission("admin.payments.review")
  const canAssign = useHasStaffPermission("admin.assignments.manage")
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("SUBMITTED")
  const [assigning, setAssigning] = useState<string | null>(null)

  const proofs = useQuery({
    queryKey: ["admin", "payment-proofs", status],
    queryFn: ({ signal }) => getPaymentProofs({ status, limit: 25 }, signal),
    placeholderData: (previous) => previous,
  })

  const agents = useQuery({
    queryKey: ["admin", "assignable-agents"],
    queryFn: ({ signal }) => getAssignableAgents(signal),
    enabled: canAssign && assigning !== null,
  })

  const review = useMutation({
    mutationFn: ({
      id,
      decision,
    }: {
      id: string
      decision: "APPROVE" | "REJECT"
    }) => {
      if (decision === "REJECT") {
        const reason = window.prompt("Why is this payment being rejected?")?.trim()
        if (!reason) throw new Error("A rejection reason is required.")
        return reviewPaymentProof(id, { decision, rejectionReason: reason })
      }
      return reviewPaymentProof(id, { decision })
    },
    onSuccess: async (result) => {
      toast.success(
        result.listingStatus === "AWAITING_AGENT"
          ? "Payment verified. Assign an agent to publish."
          : "Payment rejected and returned to the owner.",
      )
      await queryClient.invalidateQueries({ queryKey: ["admin", "payment-proofs"] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "listings"] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const assign = useMutation({
    mutationFn: ({ listingId, agentId }: { listingId: string; agentId: string }) =>
      assignListing(listingId, { agentId }),
    onSuccess: async () => {
      toast.success("Offer sent to the agent.")
      setAssigning(null)
      await queryClient.invalidateQueries({ queryKey: ["admin", "payment-proofs"] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "assignable-agents"] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const items = proofs.data?.items ?? []

  return (
    <section className="surface overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div>
          <h2 className="text-lg font-semibold">Listing payments</h2>
          <p className="text-sm text-slate-500">
            Verify owner-submitted payment proofs, then assign an agent.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {STATUSES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setStatus(option)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                status === option
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {option.charAt(0) + option.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {proofs.isPending ? (
        <p className="p-6 text-sm text-slate-500">Loading payments…</p>
      ) : items.length === 0 ? (
        <p className="p-6 text-sm text-slate-500">
          No {status.toLowerCase()} payments.
        </p>
      ) : (
        <ul className="divide-y">
          {items.map((proof) => (
            <li key={proof.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{proof.listingTitle}</p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {proof.submittedBy.name} · {proof.submittedBy.email}
                  </p>
                  <p className="mt-1 text-sm">
                    <span className="font-medium">
                      {formatMinorAmount(proof.amountMinor, proof.currency)}
                    </span>
                    <span className="text-slate-500"> via {proof.method}</span>
                    {proof.reference ? (
                      <span className="text-slate-500"> · ref {proof.reference}</span>
                    ) : null}
                  </p>
                  {proof.rejectionReason ? (
                    <p className="mt-1 text-sm text-red-600">
                      {proof.rejectionReason}
                    </p>
                  ) : null}
                </div>

                {proof.status === "SUBMITTED" && canReview ? (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={review.isPending}
                      onClick={() =>
                        review.mutate({ id: proof.id, decision: "APPROVE" })
                      }
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
                    >
                      <Check className="size-4" /> Verify
                    </button>
                    <button
                      type="button"
                      disabled={review.isPending}
                      onClick={() =>
                        review.mutate({ id: proof.id, decision: "REJECT" })
                      }
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                      <X className="size-4" /> Reject
                    </button>
                  </div>
                ) : proof.status === "APPROVED" && canAssign ? (
                  <button
                    type="button"
                    onClick={() =>
                      setAssigning(assigning === proof.listingId ? null : proof.listingId)
                    }
                    className="inline-flex h-9 shrink-0 items-center rounded-lg border px-3 text-sm font-medium hover:bg-slate-50"
                  >
                    {assigning === proof.listingId ? "Cancel" : "Assign agent"}
                  </button>
                ) : null}
              </div>

              {assigning === proof.listingId ? (
                <div className="mt-4 rounded-xl border bg-slate-50 p-3">
                  {agents.isPending ? (
                    <p className="text-sm text-slate-500">Loading agents…</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {(agents.data?.items ?? []).map((agent) => (
                        <li key={agent.id}>
                          <button
                            type="button"
                            disabled={agent.atCapacity || assign.isPending}
                            onClick={() =>
                              assign.mutate({
                                listingId: proof.listingId,
                                agentId: agent.id,
                              })
                            }
                            className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-sm font-medium">
                                {agent.name}
                              </span>
                              {agent.verified ? (
                                <BadgeCheck className="size-4 shrink-0 text-emerald-700" />
                              ) : null}
                            </span>
                            <span className="flex shrink-0 items-center gap-2 text-xs">
                              {agent.atCapacity ? (
                                <span className="font-medium text-red-600">
                                  At limit
                                </span>
                              ) : agent.nearCapacity ? (
                                <span className="inline-flex items-center gap-1 font-medium text-amber-600">
                                  <AlertTriangle className="size-3.5" />
                                  Busy
                                </span>
                              ) : null}
                              <span className="text-slate-500">
                                {agent.activeCases}/{agent.maxActiveCases}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 px-3 text-xs text-slate-500">
                    Agents are flagged from {AGENT_CASELOAD_WARN_AT} active
                    properties and cannot be assigned at their limit.
                  </p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
