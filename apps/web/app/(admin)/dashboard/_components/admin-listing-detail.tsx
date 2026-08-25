"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  History,
  MapPin,
  Pencil,
  Receipt,
  UserRoundCog,
  X,
} from "lucide-react";
import type { AdminListingDetail } from "@real-estate/contracts";
import {
  getAdminListing,
  getAdminListingChanges,
  updateAdminListing,
} from "@/features/admin/api/admin-api";
import { errorMessage } from "@/shared/http/error-message";
import { formatMinorAmount } from "@/shared/utilities/money";
import { cn } from "@/lib/utils";
import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
} from "@/components/ui/map";

const MAP_STYLE =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
  "https://tiles.openfreemap.org/styles/liberty";
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
import {
  assignListing,
  getAssignableAgents,
  reviewPaymentProof,
} from "@/features/listings/api/listing-payments-api";
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

/**
 * A record row: the value is read until someone chooses to edit it.
 *
 * Matches the hotel detail panel in the reference console — a page of
 * always-on inputs reads as a form to fill in rather than a record to
 * inspect, and makes an accidental keystroke indistinguishable from an edit.
 * One row is editable at a time, saved or cancelled from the Actions column.
 */
function DetailRows({
  fields,
  values,
  editing,
  savingField,
  editable,
  onStartEdit,
  onChangeDraft,
  onSave,
  onCancel,
}: {
  fields: readonly FieldSpec[];
  values: Draft;
  editing: { field: string; value: string } | null;
  savingField: string | null;
  editable: boolean;
  onStartEdit: (field: FieldSpec) => void;
  onChangeDraft: (value: string) => void;
  onSave: (field: FieldSpec) => void;
  onCancel: () => void;
}) {
  return (
    <>
      {fields.map((field) => {
        const isEditing = editing?.field === field.key;
        return (
          <TableRow
            key={field.key}
            className={cn(editable && "cursor-pointer")}
            onDoubleClick={() => editable && onStartEdit(field)}
          >
            <TableCell className="font-medium">{field.label}</TableCell>
            <TableCell className="whitespace-normal break-words text-muted-foreground">
              {isEditing ? (
                field.kind === "textarea" ? (
                  <Textarea
                    autoFocus
                    aria-label={field.label}
                    value={editing.value}
                    rows={5}
                    onChange={(event) => onChangeDraft(event.target.value)}
                  />
                ) : (
                  <Input
                    autoFocus
                    aria-label={field.label}
                    value={editing.value}
                    {...(field.kind === "number" ? { type: "number" } : {})}
                    onChange={(event) => onChangeDraft(event.target.value)}
                  />
                )
              ) : (
                (values[field.key] ?? "") || "—"
              )}
            </TableCell>
            <TableCell className="text-right">
              {isEditing ? (
                <div className="flex justify-end gap-1">
                  <Button
                    aria-label={`Save ${field.label}`}
                    loading={savingField === field.key}
                    onClick={() => onSave(field)}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <Check />
                  </Button>
                  <Button
                    aria-label={`Cancel ${field.label}`}
                    onClick={onCancel}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <X />
                  </Button>
                </div>
              ) : editable ? (
                <Button
                  aria-label={`Edit ${field.label}`}
                  disabled={Boolean(editing) || Boolean(savingField)}
                  onClick={() => onStartEdit(field)}
                  size="icon-sm"
                  variant="ghost"
                >
                  <Pencil />
                </Button>
              ) : null}
            </TableCell>
          </TableRow>
        );
      })}
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
  const [editing, setEditing] = useState<
    { field: string; value: string } | null
  >(null);
  const [savingField, setSavingField] = useState<string | null>(null);
  const canReviewPayment = useHasStaffPermission("admin.payments.review");
  // Reviewing a payment needs a passkey or 2FA, so the guard raises the prompt
  // rather than letting the request come back as a bare error.
  const { guard } = useStepUp();
  const canAssign = useHasStaffPermission("admin.assignments.manage");
  const [assigning, setAssigning] = useState(false);
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

  /** Saves the single field being edited; the diff is what gets audited. */
  const save = useMutation({
    mutationFn: async ({ field, value }: { field: FieldSpec; value: string }) => {
      const detail = listing.data!;
      const key = field.key;
      const trimmed = value.trim();
      const asInt = trimmed ? Number(trimmed) : null;

      if (key === "title") return updateAdminListing(slug, { title: trimmed });
      if (key === "description") {
        return updateAdminListing(slug, { description: trimmed });
      }
      if (key === "priceMinor") {
        return updateAdminListing(slug, { priceMinor: trimmed || null });
      }
      if (key === "propertyType") {
        return updateAdminListing(slug, {
          propertyType: trimmed as never,
        });
      }
      if (["municipality", "ward", "locality", "street"].includes(key)) {
        return updateAdminListing(slug, {
          address: {
            [key]:
              key === "ward" || key === "street" ? trimmed || null : trimmed,
          } as never,
        });
      }
      if (key === "areaSqFt") {
        return updateAdminListing(slug, {
          specifications: { areaSqFt: Number(trimmed) },
        });
      }
      if (
        ["bedrooms", "bathrooms", "kitchens", "floors", "parkingSpaces", "builtYear"].includes(
          key,
        )
      ) {
        return updateAdminListing(slug, {
          specifications: { [key]: asInt } as never,
        });
      }
      if (key === "startingAmountMinor" && detail.auction) {
        return updateAdminListing(slug, {
          auction: { startingAmountMinor: trimmed },
        });
      }
      if (key === "depositAmountMinor" && detail.auction) {
        return updateAdminListing(slug, {
          auction: { depositAmountMinor: trimmed || null },
        });
      }
      throw new Error("That field cannot be edited here.");
    },
    onMutate: ({ field }) => setSavingField(field.key),
    onSettled: () => setSavingField(null),
    onSuccess: (result) => {
      toast.success(result.changed ? "Listing updated." : "Nothing to change.");
      setEditing(null);
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

  const agents = useQuery({
    queryKey: ["admin", "assignable-agents"],
    queryFn: ({ signal }) => getAssignableAgents(signal),
    enabled: assigning,
  });

  const assign = useMutation({
    mutationFn: (agentId: string) =>
      assignListing(listing.data!.id, { agentId }),
    onSuccess: () => {
      toast.success("Agent offered this listing.");
      setAssigning(false);
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
  const values = toDraft(detail);
  const rowProps = {
    values,
    editing,
    savingField,
    editable: canEdit,
    onStartEdit: (field: FieldSpec) =>
      setEditing({ field: field.key, value: values[field.key] ?? "" }),
    onChangeDraft: (value: string) =>
      setEditing((current) => (current ? { ...current, value } : current)),
    onSave: (field: FieldSpec) =>
      save.mutate({ field, value: editing?.value ?? "" }),
    onCancel: () => setEditing(null),
  };

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
            <Table variant="card" className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-64">Listing</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="w-28 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <DetailRows fields={LISTING_FIELDS} {...rowProps} />
                <TableRow>
                  <TableHead className="py-2 font-normal text-muted-foreground">
                    Owner
                  </TableHead>
                  <TableCell className="whitespace-normal py-2">
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
                  <TableCell />
                </TableRow>
                <TableRow>
                  <TableHead className="py-2 font-normal text-muted-foreground">
                    Agent
                  </TableHead>
                  <TableCell className="whitespace-normal py-2">
                    <div className="flex flex-wrap items-center gap-3">
                      {detail.agent?.name ?? (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                      {/* Assignment is only accepted while the listing sits in
                          the agent queue; the API rejects it in any other state. */}
                      {canAssign && detail.status === "AWAITING_AGENT" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAssigning((open) => !open)}
                        >
                          <UserRoundCog />
                          {assigning ? "Cancel" : "Assign agent"}
                        </Button>
                      ) : null}
                    </div>
                    {assigning ? (
                      <div className="mt-3 rounded-xl border bg-muted/40 p-2">
                        {agents.isPending ? (
                          <p className="p-2 text-muted-foreground text-sm">
                            Loading agents…
                          </p>
                        ) : (agents.data?.items ?? []).length === 0 ? (
                          <p className="p-2 text-muted-foreground text-sm">
                            No agent is available to take this listing.
                          </p>
                        ) : (
                          <ul className="m-0 flex list-none flex-col gap-1 p-0">
                            {(agents.data?.items ?? []).map((agent) => (
                              <li key={agent.id}>
                                <Button
                                  className="w-full justify-between"
                                  variant="ghost"
                                  size="sm"
                                  disabled={agent.atCapacity || assign.isPending}
                                  onClick={() => assign.mutate(agent.id)}
                                >
                                  <span className="truncate">{agent.name}</span>
                                  <span className="shrink-0 text-xs">
                                    {agent.atCapacity
                                      ? "At limit"
                                      : agent.nearCapacity
                                        ? "Near limit"
                                        : "Available"}
                                  </span>
                                </Button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </Frame>

          <Frame>
            <Table variant="card" className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-64">Location</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="w-28 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableHead className="py-2 font-normal text-muted-foreground">
                    Province / district
                  </TableHead>
                  <TableCell className="whitespace-normal py-2">
                    {detail.address.province} · {detail.address.district}
                  </TableCell>
                  <TableCell />
                </TableRow>
                <DetailRows fields={ADDRESS_FIELDS} {...rowProps} />
              </TableBody>
            </Table>
          </Frame>

          {/* Where the seller actually dropped the pin. Reading coordinates as
              two numbers tells a reviewer nothing about whether the property
              is where the address claims. */}
          {detail.address.latitude !== null &&
          detail.address.longitude !== null ? (
            <Frame>
              <div className="h-[320px] w-full overflow-hidden rounded-xl">
                <Map
                  className="h-full w-full"
                  styles={{ light: MAP_STYLE, dark: MAP_STYLE }}
                  center={[detail.address.longitude, detail.address.latitude]}
                  zoom={14}
                >
                  <MapControls />
                  <MapMarker
                    longitude={detail.address.longitude}
                    latitude={detail.address.latitude}
                  >
                    <MarkerContent>
                      <MapPin
                        className="size-7 -translate-y-1/2 fill-primary text-primary-foreground drop-shadow"
                        strokeWidth={1.5}
                      />
                    </MarkerContent>
                  </MapMarker>
                </Map>
              </div>
            </Frame>
          ) : null}

          <Frame>
            <Table variant="card" className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-64">Specifications</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="w-28 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <DetailRows fields={SPEC_FIELDS} {...rowProps} />
              </TableBody>
            </Table>
          </Frame>

          {detail.auction ? (
            <Frame>
              <Table variant="card" className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-64">Auction</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead className="w-28 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableHead className="py-2 font-normal text-muted-foreground">
                      Status
                    </TableHead>
                    <TableCell className="whitespace-normal py-2">
                      <Badge variant="secondary">{detail.auction.status}</Badge>
                      <span className="ms-2 text-muted-foreground text-xs tabular-nums">
                        {detail.auction.bidCount} bids · current{" "}
                        {formatMinorAmount(
                          detail.auction.currentAmountMinor,
                          detail.currency,
                        )}
                      </span>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                  <DetailRows fields={AUCTION_FIELDS} {...rowProps} />
                </TableBody>
              </Table>
            </Frame>
          ) : null}
        </TabsPanel>

        <TabsPanel value="payment" className="grid gap-4">
          {detail.payment ? (
            <Frame>
              <Table variant="card" className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-64">Listing fee</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead className="w-28" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableHead className="py-2 font-normal text-muted-foreground">
                      Status
                    </TableHead>
                    <TableCell className="whitespace-normal py-2">
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
                    <TableCell />
                  </TableRow>
                  <TableRow>
                    <TableHead className="py-2 font-normal text-muted-foreground">
                      Amount
                    </TableHead>
                    <TableCell className="py-2 tabular-nums">
                      {formatMinorAmount(
                        detail.payment.amountMinor,
                        detail.payment.currency,
                      )}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                  <TableRow>
                    <TableHead className="py-2 font-normal text-muted-foreground">
                      Method
                    </TableHead>
                    <TableCell className="whitespace-normal py-2">
                      {detail.payment.method}
                      {detail.payment.reference ? (
                        <span className="ms-2 text-muted-foreground text-xs">
                          Ref {detail.payment.reference}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                  <TableRow>
                    <TableHead className="py-2 font-normal text-muted-foreground">
                      Submitted by
                    </TableHead>
                    <TableCell className="whitespace-normal py-2">
                      {detail.payment.submittedBy.name}
                      <span className="ms-2 text-muted-foreground text-xs tabular-nums">
                        {new Date(detail.payment.submittedAt).toLocaleString(
                          "en-NP",
                        )}
                      </span>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                  {detail.payment.rejectionReason ? (
                    <TableRow>
                      <TableHead className="py-2 font-normal text-muted-foreground">
                        Rejection reason
                      </TableHead>
                      <TableCell className="py-2 text-destructive-foreground">
                        {detail.payment.rejectionReason}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  ) : null}
                  <TableRow>
                    <TableHead className="py-2 font-normal text-muted-foreground">
                      Receipt
                    </TableHead>
                    <TableCell className="whitespace-normal py-2">
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
                    <TableCell />
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
            <Table variant="card" className="table-fixed">
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
                    <TableCell className="whitespace-normal py-2">
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
