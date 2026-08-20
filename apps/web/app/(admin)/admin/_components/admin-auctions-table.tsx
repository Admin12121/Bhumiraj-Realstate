"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gavel } from "lucide-react";

import { formatMinorAmount } from "@/shared/utilities/money";
import {
  actOnAdminAuction,
  getAdminAuctions,
} from "@/features/admin/api/admin-api";
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
import { PanelEmptyRow } from "./panel-layout";
import { useHasStaffPermission } from "./admin-shell";
import { useStepUp } from "./step-up-dialog";

const auctionStatuses = [
  "ALL",
  "DRAFT",
  "SCHEDULED",
  "LIVE",
  "PAUSED",
  "ENDED",
  "AWAITING_SETTLEMENT",
  "SETTLED",
  "CANCELLED",
] as const;

const statusItems = auctionStatuses.map((value) => ({
  value,
  label: value === "ALL" ? "All statuses" : value.replace(/_/g, " "),
}));

const cancellable = ["DRAFT", "SCHEDULED", "LIVE", "PAUSED"];

function statusVariant(status: string) {
  if (status === "LIVE") return "success" as const;
  if (status === "CANCELLED") return "error" as const;
  if (status === "PAUSED") return "warning" as const;
  return "secondary" as const;
}

export function AdminAuctionsTable() {
  const { guard } = useStepUp();
  const queryClient = useQueryClient();
  const canManage = useHasStaffPermission("admin.auctions.manage");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<(typeof auctionStatuses)[number]>("ALL");
  // Cancelling needs a reason, so it waits on the dialog instead of a prompt.
  const [cancelling, setCancelling] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [reason, setReason] = useState("");

  const query = useQuery({
    queryKey: ["admin", "auctions", page, status],
    queryFn: () => getAdminAuctions(page, 25, status === "ALL" ? "" : status),
    placeholderData: (previous) => previous,
  });

  const action = useMutation({
    mutationFn: ({
      id,
      kind,
      cancelReason,
    }: {
      id: string;
      kind: "PAUSE" | "RESUME" | "CANCEL";
      cancelReason?: string;
    }) => guard(() => actOnAdminAuction(id, kind, cancelReason)),
    onSuccess: async () => {
      toast.success("Auction state updated.");
      setCancelling(null);
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "auctions"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const items = query.data?.items ?? [];

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(1rem,1fr)_14rem]">
        <div aria-hidden className="hidden lg:block" />
        <Select
          items={statusItems}
          value={status}
          onValueChange={(value) => {
            setStatus(value as (typeof auctionStatuses)[number]);
            setPage(1);
          }}
        >
          <SelectTrigger aria-label="Filter by auction status">
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
              <TableHead>Auctions - {query.data?.total ?? 0}</TableHead>
              <TableHead className="w-40">Status</TableHead>
              <TableHead className="w-40">Current bid</TableHead>
              <TableHead className="w-24">Bids</TableHead>
              <TableHead className="w-48">Ends</TableHead>
              <TableHead className="w-56 text-right">Controls</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-semibold">
                  {row.title}
                </TableCell>
                <TableCell>
                  <Badge size="sm" variant={statusVariant(row.status)}>
                    {row.status}
                  </Badge>
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatMinorAmount(row.currentAmountMinor, row.currency)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {row.bidCount}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(row.endsAt).toLocaleString("en-NP")}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {canManage && row.status === "LIVE" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={action.isPending}
                        onClick={() =>
                          action.mutate({ id: row.id, kind: "PAUSE" })
                        }
                      >
                        Pause
                      </Button>
                    ) : null}
                    {canManage && row.status === "PAUSED" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={action.isPending}
                        onClick={() =>
                          action.mutate({ id: row.id, kind: "RESUME" })
                        }
                      >
                        Resume
                      </Button>
                    ) : null}
                    {canManage && cancellable.includes(row.status) ? (
                      <Button
                        size="sm"
                        variant="destructive-outline"
                        disabled={action.isPending}
                        onClick={() =>
                          setCancelling({ id: row.id, title: row.title })
                        }
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            <PanelEmptyRow
              colSpan={6}
              when={items.length === 0}
              icon={Gavel}
              title={query.isLoading ? "Loading…" : "No auctions match this filter"}
              description={query.isError ? "Auctions could not be loaded." : "Scheduled and live auctions appear here."}
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
        open={Boolean(cancelling)}
        onOpenChange={(open) => {
          if (!open) {
            setCancelling(null);
            setReason("");
          }
        }}
      >
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Cancel auction</DialogTitle>
            <DialogDescription>
              {cancelling?.title} stops accepting bids. Registered bidders are
              notified with this reason.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <Field>
              <FieldLabel>Cancellation reason</FieldLabel>
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain why the auction is being cancelled"
                minLength={3}
                required
              />
            </Field>
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Keep running</Button>} />
            <Button
              variant="destructive"
              loading={action.isPending}
              disabled={reason.trim().length < 3}
              onClick={() => {
                if (!cancelling) return;
                action.mutate({
                  id: cancelling.id,
                  kind: "CANCEL",
                  cancelReason: reason.trim(),
                });
              }}
            >
              Cancel auction
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
