"use client";

import Link from "next/link"
import { Check, EllipsisVertical, Eye, X } from "lucide-react"
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuLinkItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu"
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { toast } from "sonner";
import { Building2, Search } from "lucide-react";

import { listingStatusSchema } from "@real-estate/contracts";
import {
  decideAdminListing,
  getAdminListings,
} from "@/features/admin/api/admin-api";
import { formatMinorAmount } from "@/shared/utilities/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Frame } from "@/components/ui/frame";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { TablePagination } from "@/components/ui/table-pagination";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PanelEmptyRow } from "../../_components/panel-layout";
import { useHasStaffPermission } from "../../_components/admin-shell";
import { errorMessage } from "@/shared/http/error-message";

// Derived from the schema so a new status cannot go missing from the filter,
// which is how AWAITING_AGENT listings became unreachable here.
const statuses = ["ALL", ...listingStatusSchema.options] as const;

const statusItems = statuses.map((value) => ({
  value,
  label: value === "ALL" ? "All statuses" : value.replace(/_/g, " "),
}));

function statusVariant(status: string) {
  if (status === "PUBLISHED") return "success" as const;
  if (status === "REJECTED") return "error" as const;
  if (status === "PENDING_REVIEW") return "warning" as const;
  return "secondary" as const;
}

export function AdminListingsTable() {
  const canModerate = useHasStaffPermission("admin.listings.moderate");
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<(typeof statuses)[number]>(
    "ALL",
  );
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  // Rejecting needs a reason, so the decision waits on the dialog.
  const [rejecting, setRejecting] = useState<{ id: string; title: string } | null>(
    null,
  );
  const [reason, setReason] = useState("");

  const query = useQuery({
    queryKey: ["admin", "listings", page, status, debouncedSearch],
    queryFn: () =>
      getAdminListings(page, 25, status === "ALL" ? "" : status, debouncedSearch),
    placeholderData: (previous) => previous,
  });

  const decision = useMutation({
    mutationFn: ({
      id,
      action,
      rejectionReason,
    }: {
      id: string;
      action: "PUBLISH" | "REJECT";
      rejectionReason?: string;
    }) => decideAdminListing(id, action, rejectionReason),
    onSuccess: async () => {
      toast.success("Listing moderation decision saved.");
      setRejecting(null);
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "listings"] });
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  });

  const items = query.data?.items ?? [];

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(18rem,26rem)_minmax(1rem,1fr)_13rem]">
        <InputGroup>
          <InputGroupInput
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search listing, slug or owner email"
            aria-label="Search listings"
            type="search"
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>

        <div aria-hidden className="hidden lg:block" />
        <Select
          items={statusItems}
          value={status}
          onValueChange={(value) => {
            setStatus(value as (typeof statuses)[number]);
            setPage(1);
          }}
        >
          <SelectTrigger aria-label="Filter by listing status">
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            {statusItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      </div>

      <Frame>
        <Table variant="card">
          <TableHeader>
            <TableRow>
              <TableHead>Listings - {query.data?.total ?? 0}</TableHead>
              <TableHead className="w-56">Owner</TableHead>
              <TableHead className="w-40">Type</TableHead>
              <TableHead className="w-36">Price</TableHead>
              <TableHead className="w-36">Status</TableHead>
              <TableHead className="w-28">Created</TableHead>
              <TableHead className="w-44 text-right">Moderation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((row) => (
              <TableRow key={row.id} className="align-top">
                <TableCell>
                  <Link
                    href={`/dashboard/listings/${row.slug}`}
                    className="font-semibold hover:underline"
                  >
                    {row.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">{row.slug}</p>
                </TableCell>
                <TableCell>
                  <p>{row.owner.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.owner.email}
                  </p>
                </TableCell>
                <TableCell>
                  {row.type} · {row.propertyType}
                </TableCell>
                <TableCell className="tabular-nums">
                  {row.priceMinor
                    ? formatMinorAmount(row.priceMinor, row.currency)
                    : "Auction"}
                </TableCell>
                <TableCell>
                  <Badge size="sm" variant={statusVariant(row.status)}>
                    {row.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(row.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <Menu>
                    <MenuTrigger
                      render={
                        <Button
                          aria-label={`Actions for ${row.title}`}
                          size="icon-sm"
                          variant="ghost"
                        />
                      }
                    >
                      <EllipsisVertical />
                    </MenuTrigger>
                    <MenuPopup align="end">
                      <MenuGroup>
                        <MenuGroupLabel>Listing</MenuGroupLabel>
                        <MenuLinkItem
                          render={
                            <Link href={`/dashboard/listings/${row.slug}`} />
                          }
                        >
                          <Eye />
                          Open details
                        </MenuLinkItem>
                      </MenuGroup>
                      {canModerate &&
                      (row.status === "PENDING_REVIEW" ||
                        row.status === "REJECTED") ? (
                        <>
                          <MenuSeparator />
                          <MenuGroup>
                            <MenuGroupLabel>Moderation</MenuGroupLabel>
                            <MenuItem
                              disabled={decision.isPending}
                              onClick={() =>
                                decision.mutate({
                                  id: row.id,
                                  action: "PUBLISH",
                                })
                              }
                            >
                              <Check />
                              Publish
                            </MenuItem>
                            <MenuItem
                              variant="destructive"
                              disabled={decision.isPending}
                              onClick={() =>
                                setRejecting({ id: row.id, title: row.title })
                              }
                            >
                              <X />
                              Reject
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
              colSpan={7}
              when={items.length === 0}
              icon={Building2}
              title={query.isLoading ? "Loading…" : "No listings match these filters"}
              description={query.isError ? "Listings could not be loaded." : "Try a different status or clear the search."}
            />
          </TableBody>
        </Table>
      </Frame>

      <TablePagination
        currentPage={page}
        totalPages={query.data?.pageCount ?? 1}
        totalItems={query.data?.total}
        pageSize={query.data?.pageSize}
        onPageChange={setPage}
      />

      <Dialog
        open={Boolean(rejecting)}
        onOpenChange={(open) => {
          if (!open) {
            setRejecting(null);
            setReason("");
          }
        }}
      >
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Reject listing</DialogTitle>
            <DialogDescription>
              {rejecting?.title} stays unpublished. The reason is sent to the
              owner and recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <Field>
              <FieldLabel>Reason for rejection</FieldLabel>
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain what needs to change"
                minLength={3}
                required
              />
            </Field>
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              variant="destructive"
              loading={decision.isPending}
              disabled={reason.trim().length < 3}
              onClick={() => {
                if (!rejecting) return;
                decision.mutate({
                  id: rejecting.id,
                  action: "REJECT",
                  rejectionReason: reason.trim(),
                });
              }}
            >
              Reject listing
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
