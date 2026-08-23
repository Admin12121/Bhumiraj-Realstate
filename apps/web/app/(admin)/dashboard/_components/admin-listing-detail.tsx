"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Check, ExternalLink, History, Receipt, X } from "lucide-react";
import type { AdminListingDetail } from "@real-estate/contracts";
import {
  getAdminListing,
  getAdminListingChanges,
  updateAdminListing,
} from "@/features/admin/api/admin-api";
import { errorMessage } from "@/shared/http/error-message";
import { formatMinorAmount } from "@/shared/utilities/money";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Frame } from "@/components/ui/frame";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PanelEmptyRow } from "./panel-layout";
import { useHasStaffPermission } from "./admin-shell";
import { useStepUp } from "./step-up-dialog";
import { reviewPaymentProof } from "@/features/listings/api/listing-payments-api";
import { getMediaDownloadUrl } from "@/features/media/api/media-api";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";

/** Every editable value, flattened so one table can drive the whole record. */
type Draft = Record<string, string>;

function toDraft(listing: AdminListingDetail): Draft {
  return {
    title: listing.title,
    description: listing.description,
    priceMinor: listing.priceMinor ?? "",
    rentPeriod: listing.rentPeriod ?? "",
    propertyType: listing.propertyType,
    municipality: listing.address.municipality,
    ward: listing.address.ward ?? "",
    locality: listing.address.locality,
    street: listing.address.street ?? "",
    bedrooms: listing.specifications.bedrooms?.toString() ?? "",
    bathrooms: listing.specifications.bathrooms?.toString() ?? "",
    kitchens: listing.specifications.kitchens?.toString() ?? "",
    floors: listing.specifications.floors?.toString() ?? "",
    parkingSpaces: listing.specifications.parkingSpaces?.toString() ?? "",
    areaSqFt: listing.specifications.areaSqFt?.toString() ?? "",
    builtYear: listing.specifications.builtYear?.toString() ?? "",
    startingAmountMinor: listing.auction?.startingAmountMinor ?? "",
    minimumIncrementMinor: "",
    depositAmountMinor: listing.auction?.depositAmountMinor ?? "",
  };
}

type FieldSpec = {
  key: keyof Draft & string;
  label: string;
  kind?: "text" | "number" | "textarea";
};

const LISTING_FIELDS: readonly FieldSpec[] = [
  { key: "title", label: "Title" },
  { key: "description", label: "Description", kind: "textarea" },
  { key: "priceMinor", label: "Price (minor units)", kind: "number" },
  { key: "propertyType", label: "Property type" },
];

const ADDRESS_FIELDS: readonly FieldSpec[] = [
  { key: "municipality", label: "Municipality" },
  { key: "ward", label: "Ward" },
  { key: "locality", label: "Locality" },
  { key: "street", label: "Street" },
];

const SPEC_FIELDS: readonly FieldSpec[] = [
  { key: "bedrooms", label: "Bedrooms", kind: "number" },
  { key: "bathrooms", label: "Bathrooms", kind: "number" },
  { key: "kitchens", label: "Kitchens", kind: "number" },
  { key: "floors", label: "Floors", kind: "number" },
  { key: "parkingSpaces", label: "Parking spaces", kind: "number" },
  { key: "areaSqFt", label: "Area (sq. ft.)", kind: "number" },
  { key: "builtYear", label: "Year built", kind: "number" },
];

const AUCTION_FIELDS: readonly FieldSpec[] = [
  { key: "startingAmountMinor", label: "Starting amount", kind: "number" },
  { key: "depositAmountMinor", label: "Bidder deposit", kind: "number" },
];

const optionalInt = (value: string) =>
  value.trim() ? Number(value) : null;

/** One editable row: label on the left, the control on the right. */
function EditableRows({
  fields,
  draft,
  editable,
  onChange,
}: {
  fields: readonly FieldSpec[];
  draft: Draft;
  editable: boolean;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <>
      {fields.map((field) => (
        <TableRow key={field.key}>
          <TableHead className="w-56 py-2 font-normal text-muted-foreground">
            {field.label}
          </TableHead>
          <TableCell className="py-2">
            {field.kind === "textarea" ? (
              <Textarea
                aria-label={field.label}
                value={draft[field.key] ?? ""}
                disabled={!editable}
                rows={4}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
            ) : (
              <Input
                aria-label={field.label}
                value={draft[field.key] ?? ""}
                disabled={!editable}
                {...(field.kind === "number" ? { type: "number" } : {})}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
            )}
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

/**
 * The record behind a listing, as an editable table.
 *
 * Every change is written to the audit log with the actor and the before/after
 * values, so the History tab answers "who changed this, and when".
 */
export function AdminListingDetailView({ slug }: { slug: string }) {
  const client = useQueryClient();
  const canEdit = useHasStaffPermission("admin.listings.moderate");
  const [draft, setDraft] = useState<Draft | null>(null);
  const canReviewPayment = useHasStaffPermission("admin.payments.review");
  // Reviewing a payment needs a passkey or 2FA, so the guard raises the prompt
  // rather than letting the request come back as a bare error.
  const { guard } = useStepUp();
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const listing = useQuery({
    queryKey: ["admin", "listing", slug],
    queryFn: ({ signal }) => getAdminListing(slug, signal),
  });
  const changes = useQuery({
    queryKey: ["admin", "listing", slug, "changes"],
    queryFn: ({ signal }) => getAdminListingChanges(slug, signal),
  });

  const save = useMutation({
    mutationFn: (values: Draft) => {
      const detail = listing.data!;
      return updateAdminListing(slug, {
        title: values.title ?? "",
        description: values.description ?? "",
        priceMinor: values.priceMinor?.trim() ? values.priceMinor : null,
        propertyType:
          values.propertyType as NonNullable<AdminListingDetail["propertyType"]> as never,
        address: {
          municipality: values.municipality ?? "",
          ward: values.ward?.trim() ? values.ward : null,
          locality: values.locality ?? "",
          street: values.street?.trim() ? values.street : null,
        },
        specifications: {
          bedrooms: optionalInt(values.bedrooms ?? ""),
          bathrooms: optionalInt(values.bathrooms ?? ""),
          kitchens: optionalInt(values.kitchens ?? ""),
          floors: optionalInt(values.floors ?? ""),
          parkingSpaces: optionalInt(values.parkingSpaces ?? ""),
          ...(values.areaSqFt?.trim()
            ? { areaSqFt: Number(values.areaSqFt) }
            : {}),
          builtYear: optionalInt(values.builtYear ?? ""),
        },
        ...(detail.auction
          ? {
              auction: {
                ...(values.startingAmountMinor?.trim()
                  ? { startingAmountMinor: values.startingAmountMinor }
                  : {}),
                depositAmountMinor: values.depositAmountMinor?.trim()
                  ? values.depositAmountMinor
                  : null,
              },
            }
          : {}),
      });
    },
    onSuccess: (result) => {
      toast.success(result.changed ? "Listing updated." : "Nothing to change.");
      setDraft(null);
      void client.invalidateQueries({ queryKey: ["admin", "listing", slug] });
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  });

  const review = useMutation({
    mutationFn: (input: {
      decision: "APPROVE" | "REJECT";
      rejectionReason?: string;
    }) => guard(() => reviewPaymentProof(listing.data!.payment!.id, input)),
    onSuccess: () => {
      toast.success("Payment reviewed.");
      setRejecting(false);
      setRejectionReason("");
      void client.invalidateQueries({ queryKey: ["admin", "listing", slug] });
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  });

  async function openProof(assetId: string) {
    try {
      const { url } = await getMediaDownloadUrl(assetId);
      setProofUrl(url);
    } catch (cause) {
      toast.error(errorMessage(cause));
    }
  }

  if (listing.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64 rounded-md" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (listing.isError || !listing.data) {
    return (
      <Alert variant="error">
        <AlertTitle>Listing not found</AlertTitle>
        <AlertDescription>
          No listing exists with the slug “{slug}”.
        </AlertDescription>
      </Alert>
    );
  }

  const detail = listing.data;
  // Derived, not synced through an effect: the draft takes over on first edit.
  const values = draft ?? toDraft(detail);
  const set = (key: string, value: string) =>
    setDraft((current) => ({ ...(current ?? toDraft(detail)), [key]: value }));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            render={<Link href="/dashboard/listings" />}
            size="icon-sm"
            variant="ghost"
            aria-label="Back to listings"
          >
            <ArrowLeft />
          </Button>
          <div className="min-w-0">
            <p className="truncate font-medium">{detail.title}</p>
            <p className="truncate text-muted-foreground text-xs">
              {detail.slug}
            </p>
          </div>
          <Badge variant={detail.status === "PUBLISHED" ? "success" : "secondary"}>
            {detail.status}
          </Badge>
          {detail.isVerified ? <Badge variant="success">Verified</Badge> : null}
        </div>
        <div className="flex gap-2">
          {detail.status === "PUBLISHED" ? (
            <Button
              render={<Link href={`/properties/${detail.slug}`} />}
              size="sm"
              variant="outline"
            >
              <ExternalLink />
              View public page
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              size="sm"
              loading={save.isPending}
              disabled={draft === null}
              onClick={() => save.mutate(values)}
            >
              Save changes
            </Button>
          ) : null}
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTab value="details">Details</TabsTab>
          <TabsTab value="payment">
            Payment
            {detail.payment?.status === "SUBMITTED" ? (
              <Badge className="ms-2" variant="secondary">
                1
              </Badge>
            ) : null}
          </TabsTab>
          <TabsTab value="media">Photos ({detail.images.length})</TabsTab>
          <TabsTab value="history">History</TabsTab>
        </TabsList>

        <TabsPanel value="details" className="grid gap-4">
          <Frame>
            <Table variant="card">
              <TableHeader>
                <TableRow>
                  <TableHead>Listing</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <EditableRows
                  fields={LISTING_FIELDS}
                  draft={values}
                  editable={canEdit}
                  onChange={set}
                />
                <TableRow>
                  <TableHead className="w-56 py-2 font-normal text-muted-foreground">
                    Owner
                  </TableHead>
                  <TableCell className="py-2">
                    <Link
                      href={`/dashboard/users/${detail.owner.id}`}
                      className="hover:underline"
                    >
                      {detail.owner.name}
                    </Link>
                    <span className="ms-2 text-muted-foreground text-xs">
                      {detail.owner.email}
                    </span>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableHead className="w-56 py-2 font-normal text-muted-foreground">
                    Agent
                  </TableHead>
                  <TableCell className="py-2">
                    {detail.agent?.name ?? (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Frame>

          <Frame>
            <Table variant="card">
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableHead className="w-56 py-2 font-normal text-muted-foreground">
                    Province / district
                  </TableHead>
                  <TableCell className="py-2">
                    {detail.address.province} · {detail.address.district}
                  </TableCell>
                </TableRow>
                <EditableRows
                  fields={ADDRESS_FIELDS}
                  draft={values}
                  editable={canEdit}
                  onChange={set}
                />
              </TableBody>
            </Table>
          </Frame>

          <Frame>
            <Table variant="card">
              <TableHeader>
                <TableRow>
                  <TableHead>Specifications</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <EditableRows
                  fields={SPEC_FIELDS}
                  draft={values}
                  editable={canEdit}
                  onChange={set}
                />
              </TableBody>
            </Table>
          </Frame>

          {detail.auction ? (
            <Frame>
              <Table variant="card">
                <TableHeader>
                  <TableRow>
                    <TableHead>Auction</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableHead className="w-56 py-2 font-normal text-muted-foreground">
                      Status
                    </TableHead>
                    <TableCell className="py-2">
                      <Badge variant="secondary">{detail.auction.status}</Badge>
                      <span className="ms-2 text-muted-foreground text-xs tabular-nums">
                        {detail.auction.bidCount} bids · current{" "}
                        {formatMinorAmount(
                          detail.auction.currentAmountMinor,
                          detail.currency,
                        )}
                      </span>
                    </TableCell>
                  </TableRow>
                  <EditableRows
                    fields={AUCTION_FIELDS}
                    draft={values}
                    editable={canEdit}
                    onChange={set}
                  />
                </TableBody>
              </Table>
            </Frame>
          ) : null}
        </TabsPanel>

        <TabsPanel value="payment" className="grid gap-4">
          {detail.payment ? (
            <Frame>
              <Table variant="card">
                <TableHeader>
                  <TableRow>
                    <TableHead>Listing fee</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableHead className="w-56 py-2 font-normal text-muted-foreground">
                      Status
                    </TableHead>
                    <TableCell className="py-2">
                      <Badge
                        variant={
                          detail.payment.status === "APPROVED"
                            ? "success"
                            : detail.payment.status === "REJECTED"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {detail.payment.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableHead className="w-56 py-2 font-normal text-muted-foreground">
                      Amount
                    </TableHead>
                    <TableCell className="py-2 tabular-nums">
                      {formatMinorAmount(
                        detail.payment.amountMinor,
                        detail.payment.currency,
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableHead className="w-56 py-2 font-normal text-muted-foreground">
                      Method
                    </TableHead>
                    <TableCell className="py-2">
                      {detail.payment.method}
                      {detail.payment.reference ? (
                        <span className="ms-2 text-muted-foreground text-xs">
                          Ref {detail.payment.reference}
                        </span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableHead className="w-56 py-2 font-normal text-muted-foreground">
                      Submitted by
                    </TableHead>
                    <TableCell className="py-2">
                      {detail.payment.submittedBy.name}
                      <span className="ms-2 text-muted-foreground text-xs tabular-nums">
                        {new Date(detail.payment.submittedAt).toLocaleString(
                          "en-NP",
                        )}
                      </span>
                    </TableCell>
                  </TableRow>
                  {detail.payment.rejectionReason ? (
                    <TableRow>
                      <TableHead className="w-56 py-2 font-normal text-muted-foreground">
                        Rejection reason
                      </TableHead>
                      <TableCell className="py-2 text-destructive-foreground">
                        {detail.payment.rejectionReason}
                      </TableCell>
                    </TableRow>
                  ) : null}
                  <TableRow>
                    <TableHead className="w-56 py-2 font-normal text-muted-foreground">
                      Receipt
                    </TableHead>
                    <TableCell className="py-2">
                      {proofUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={proofUrl}
                          alt="Payment receipt"
                          className="max-h-[420px] rounded-lg border bg-muted/40 object-contain"
                        />
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void openProof(detail.payment!.mediaAssetId)
                          }
                        >
                          <Receipt />
                          Show receipt
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Frame>
          ) : (
            <Alert>
              <AlertTitle>No payment submitted</AlertTitle>
              <AlertDescription>
                The seller has not uploaded a listing-fee receipt for this
                property.
              </AlertDescription>
            </Alert>
          )}

          {detail.payment?.status === "SUBMITTED" && canReviewPayment ? (
            <div className="flex justify-end gap-2">
              <Button
                variant="destructive-outline"
                disabled={review.isPending}
                onClick={() => setRejecting(true)}
              >
                <X />
                Reject payment
              </Button>
              <Button
                loading={review.isPending}
                onClick={() => review.mutate({ decision: "APPROVE" })}
              >
                <Check />
                Approve and publish
              </Button>
            </div>
          ) : null}
        </TabsPanel>

        <TabsPanel value="media">
          <Frame>
            <div className="grid gap-3 p-1 sm:grid-cols-3">
              {detail.images.map((image) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={image.id}
                  src={image.url}
                  alt=""
                  className="aspect-[4/3] w-full rounded-lg border object-cover"
                />
              ))}
              {detail.images.length === 0 ? (
                <p className="p-5 text-muted-foreground text-sm">
                  No photos on this listing.
                </p>
              ) : null}
            </div>
          </Frame>
        </TabsPanel>

        <TabsPanel value="history">
          <Frame>
            <Table variant="card">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">When</TableHead>
                  <TableHead className="w-40">Who</TableHead>
                  <TableHead className="w-44">Action</TableHead>
                  <TableHead>What changed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(changes.data?.items ?? []).map((entry) => (
                  <TableRow key={entry.id} className="align-top">
                    <TableCell className="py-2 text-muted-foreground text-xs tabular-nums">
                      {new Date(entry.createdAt).toLocaleString("en-NP")}
                    </TableCell>
                    <TableCell className="py-2 text-sm">
                      {entry.actor?.name ?? "System"}
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant="secondary">{entry.action}</Badge>
                    </TableCell>
                    <TableCell className="py-2 text-xs">
                      {entry.after && Object.keys(entry.after).length > 0 ? (
                        <ul className="m-0 list-none space-y-1 p-0">
                          {Object.entries(entry.after).map(([key, value]) => (
                            <li key={key}>
                              <span className="text-muted-foreground">
                                {key}:
                              </span>{" "}
                              <span className="line-through opacity-60">
                                {String(entry.before?.[key] ?? "—")}
                              </span>{" "}
                              → <span className="font-medium">{String(value)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-muted-foreground">
                          {entry.reason ?? "—"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                <PanelEmptyRow
                  colSpan={4}
                  when={(changes.data?.items ?? []).length === 0}
                  icon={History}
                  title={
                    changes.isPending ? "Loading history…" : "No changes recorded"
                  }
                  description="Edits and moderation decisions appear here."
                />
              </TableBody>
            </Table>
          </Frame>
        </TabsPanel>
      </Tabs>

      <Dialog
        open={rejecting}
        onOpenChange={(next) => {
          setRejecting(next);
          if (!next) setRejectionReason("");
        }}
      >
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Reject this payment</DialogTitle>
            <DialogDescription>
              The seller sees this message, so say what was wrong with the
              receipt and what they should send instead.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <Field>
              <FieldLabel htmlFor="payment-rejection">Reason</FieldLabel>
              <Textarea
                id="payment-rejection"
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                rows={4}
                maxLength={500}
                placeholder="The screenshot does not show the transaction amount."
              />
            </Field>
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              variant="destructive"
              loading={review.isPending}
              disabled={rejectionReason.trim().length < 3}
              onClick={() =>
                review.mutate({
                  decision: "REJECT",
                  rejectionReason: rejectionReason.trim(),
                })
              }
            >
              Reject payment
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
