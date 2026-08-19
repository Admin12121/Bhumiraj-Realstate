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
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Frame } from "@/components/ui/frame"
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
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
  // A rejection reason is required, so the decision waits on the dialog.
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")

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
      rejectionReason,
    }: {
      id: string
      decision: "APPROVE" | "REJECT"
      rejectionReason?: string
    }) =>
      decision === "REJECT"
        ? reviewPaymentProof(id, { decision, rejectionReason: rejectionReason! })
        : reviewPaymentProof(id, { decision }),
    onSuccess: async (result) => {
      setRejecting(null)
      setRejectionReason("")
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
    <div className="grid gap-4">
      <Tabs
        value={status}
        onValueChange={(value) => setStatus(value as (typeof STATUSES)[number])}
      >
        <TabsList>
          {STATUSES.map((option) => (
            <TabsTab key={option} value={option}>
              {option.charAt(0) + option.slice(1).toLowerCase()}
            </TabsTab>
          ))}
        </TabsList>
      </Tabs>

      <Frame>
        <div className="rounded-xl border bg-background bg-clip-padding">

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
                    <Button
                      disabled={review.isPending}
                      onClick={() =>
                        review.mutate({ id: proof.id, decision: "APPROVE" })
                      }
                    >
                      <Check /> Verify
                    </Button>
                    <Button
                      variant="destructive-outline"
                      disabled={review.isPending}
                      onClick={() => setRejecting(proof.id)}
                    >
                      <X /> Reject
                    </Button>
                  </div>
                ) : proof.status === "APPROVED" && canAssign ? (
                  <Button
                    variant="outline"
                    className="shrink-0"
                    onClick={() =>
                      setAssigning(assigning === proof.listingId ? null : proof.listingId)
                    }
                  >
                    {assigning === proof.listingId ? "Cancel" : "Assign agent"}
                  </Button>
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
        </div>
      </Frame>

      <Dialog
        open={Boolean(rejecting)}
        onOpenChange={(open) => {
          if (!open) {
            setRejecting(null)
            setRejectionReason("")
          }
        }}
      >
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Reject payment</DialogTitle>
            <DialogDescription>
              The listing is returned to the owner with this reason so they can
              submit a corrected proof.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <Field>
              <FieldLabel>Reason for rejection</FieldLabel>
              <Textarea
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder="Explain what is wrong with the payment proof"
                minLength={3}
                required
              />
            </Field>
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              variant="destructive"
              loading={review.isPending}
              disabled={rejectionReason.trim().length < 3}
              onClick={() => {
                if (!rejecting) return
                review.mutate({
                  id: rejecting,
                  decision: "REJECT",
                  rejectionReason: rejectionReason.trim(),
                })
              }}
            >
              Reject payment
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  )
}

