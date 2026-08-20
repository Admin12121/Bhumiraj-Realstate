"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  AlertTriangle,
  BadgeCheck,
  BadgeDollarSign,
  Check,
  EllipsisVertical,
  Receipt,
  UserRoundCog,
  X,
} from "lucide-react"
import {
  assignListing,
  getAssignableAgents,
  getPaymentProofs,
  reviewPaymentProof,
} from "@/features/listings/api/listing-payments-api"
import { getMediaDownloadUrl } from "@/features/media/api/media-api"
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
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu"
import { Frame } from "@/components/ui/frame"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PanelEmptyRow } from "./panel-layout"
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useHasStaffPermission } from "./admin-shell"
import { errorMessage } from "@/shared/http/error-message";

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
  // The receipt itself. Private media, so the URL is signed and short-lived.
  const [proofUrl, setProofUrl] = useState<string | null>(null)
  const [loadingProof, setLoadingProof] = useState(false)

  async function openProof(assetId: string) {
    setLoadingProof(true)
    try {
      const { url } = await getMediaDownloadUrl(assetId)
      setProofUrl(url)
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "The payment proof could not be opened.",
      )
    } finally {
      setLoadingProof(false)
    }
  }

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
    onError: (error: unknown) => toast.error(errorMessage(error)),
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
    onError: (error: unknown) => toast.error(errorMessage(error)),
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
        <Table variant="card">
          <TableHeader>
            <TableRow>
              <TableHead>Property — {items.length}</TableHead>
              <TableHead className="w-56">Submitted by</TableHead>
              <TableHead className="w-44">Amount</TableHead>
              <TableHead className="w-40">Method</TableHead>
              <TableHead className="w-56 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((proof) => (
              <TableRow key={proof.id} className="align-top">
                <TableCell className="max-w-0">
                  <p className="truncate font-medium">{proof.listingTitle}</p>
                  {proof.rejectionReason ? (
                    <p className="truncate text-xs text-destructive">
                      {proof.rejectionReason}
                    </p>
                  ) : null}
                  {assigning === proof.listingId ? (
                    <div className="mt-3 rounded-xl border bg-muted/40 p-2">
                      {agents.isPending ? (
                        <p className="p-2 text-sm text-muted-foreground">
                          Loading agents…
                        </p>
                      ) : (agents.data?.items ?? []).length === 0 ? (
                        <p className="p-2 text-sm text-muted-foreground">
                          No agent is available to take this listing.
                        </p>
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
                                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  <span className="truncate text-sm font-medium">
                                    {agent.name}
                                  </span>
                                  {agent.verified ? (
                                    <BadgeCheck className="size-4 shrink-0 text-emerald-700" />
                                  ) : null}
                                </span>
                                <span className="shrink-0 text-xs">
                                  {agent.atCapacity ? (
                                    <span className="font-medium text-destructive">
                                      At limit
                                    </span>
                                  ) : agent.nearCapacity ? (
                                    <span className="inline-flex items-center gap-1 font-medium text-amber-600">
                                      <AlertTriangle className="size-3.5" />
                                      Near limit
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      Available
                                    </span>
                                  )}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="max-w-0">
                  <p className="truncate">{proof.submittedBy.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {proof.submittedBy.email}
                  </p>
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatMinorAmount(proof.amountMinor, proof.currency)}
                </TableCell>
                <TableCell>
                  <p>{proof.method}</p>
                  {proof.reference ? (
                    <p className="truncate text-xs text-muted-foreground">
                      Ref {proof.reference}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell className="text-right">
                  <Menu>
                    <MenuTrigger
                      render={
                        <Button
                          aria-label={`Actions for ${proof.listingTitle}`}
                          size="icon-sm"
                          variant="ghost"
                        />
                      }
                    >
                      <EllipsisVertical />
                    </MenuTrigger>
                    <MenuPopup align="end">
                      <MenuGroup>
                        <MenuGroupLabel>Payment</MenuGroupLabel>
                        <MenuItem
                          disabled={loadingProof}
                          onClick={() => void openProof(proof.mediaAssetId)}
                        >
                          <Receipt />
                          View proof
                        </MenuItem>
                      </MenuGroup>
                      {proof.status === "SUBMITTED" && canReview ? (
                        <>
                          <MenuSeparator />
                          <MenuGroup>
                            <MenuGroupLabel>Decision</MenuGroupLabel>
                            <MenuItem
                              disabled={review.isPending}
                              onClick={() =>
                                review.mutate({
                                  id: proof.id,
                                  decision: "APPROVE",
                                })
                              }
                            >
                              <Check />
                              Verify payment
                            </MenuItem>
                            <MenuItem
                              disabled={review.isPending}
                              onClick={() => setRejecting(proof.id)}
                              variant="destructive"
                            >
                              <X />
                              Reject payment
                            </MenuItem>
                          </MenuGroup>
                        </>
                      ) : null}
                      {proof.status === "APPROVED" && canAssign ? (
                        <>
                          <MenuSeparator />
                          <MenuGroup>
                            <MenuGroupLabel>Listing</MenuGroupLabel>
                            <MenuItem
                              onClick={() =>
                                setAssigning(
                                  assigning === proof.listingId
                                    ? null
                                    : proof.listingId,
                                )
                              }
                            >
                              <UserRoundCog />
                              {assigning === proof.listingId
                                ? "Cancel assignment"
                                : "Assign agent"}
                            </MenuItem>
                          </MenuGroup>
                        </>
                      ) : null}
                    </MenuPopup>
                  </Menu>
                </TableCell>
              </TableRow>
            ))}
            <PanelEmptyRow
              colSpan={5}
              when={items.length === 0}
              icon={BadgeDollarSign}
              title={
                proofs.isPending
                  ? "Loading payments…"
                  : `No ${status.toLowerCase()} payments`
              }
              description={
                status === "SUBMITTED"
                  ? "Owner-submitted payment proofs appear here for verification."
                  : "Nothing has reached this state yet."
              }
            />
          </TableBody>
        </Table>
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

      <Dialog
        open={proofUrl !== null}
        onOpenChange={(next) => {
          if (!next) setProofUrl(null)
        }}
      >
        <DialogPopup className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment proof</DialogTitle>
            <DialogDescription>
              Check the amount and reference against the record before
              verifying.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            {proofUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={proofUrl}
                alt="Payment receipt"
                className="max-h-[70vh] w-full rounded-lg border bg-muted/40 object-contain"
              />
            ) : null}
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Close</Button>} />
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  )
}

