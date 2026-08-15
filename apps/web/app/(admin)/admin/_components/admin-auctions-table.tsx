"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatMinorAmount } from "@/shared/utilities/money";
import { actOnAdminAuction, getAdminAuctions } from "@/features/admin/api/admin-api";
import { AdminPagination } from "./admin-pagination";
import { useHasStaffPermission } from "./admin-shell";

const auctionStatuses = [
  "DRAFT",
  "SCHEDULED",
  "LIVE",
  "PAUSED",
  "ENDED",
  "AWAITING_SETTLEMENT",
  "SETTLED",
  "CANCELLED",
] as const;

export function AdminAuctionsTable() {
  const queryClient = useQueryClient();
  const canManage = useHasStaffPermission("admin.auctions.manage");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");

  const query = useQuery({
    queryKey: ["admin", "auctions", page, status],
    queryFn: () => getAdminAuctions(page, 25, status),
    placeholderData: (previous) => previous,
  });

  const action = useMutation({
    mutationFn: async ({
      id,
      kind,
    }: {
      id: string;
      kind: "PAUSE" | "RESUME" | "CANCEL";
    }) => {
      const reason =
        kind === "CANCEL"
          ? window.prompt("Cancellation reason:")?.trim()
          : undefined;
      if (kind === "CANCEL" && !reason) {
        throw new Error("A cancellation reason is required.");
      }
      return actOnAdminAuction(id, kind, reason);
    },
    onSuccess: async () => {
      toast.success("Auction state updated.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "auctions"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="surface overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b p-4">
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className="h-10 rounded-lg border bg-white px-3 text-sm"
        >
          <option value="">All statuses</option>
          {auctionStatuses.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <span className="text-xs text-slate-500">
          {query.data?.total ?? 0} auctions
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3">Auction</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Current bid</th>
              <th className="px-5 py-3">Bids</th>
              <th className="px-5 py-3">Ends</th>
              <th className="px-5 py-3 text-right">Controls</th>
            </tr>
          </thead>
          <tbody>
            {query.data?.items.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-5 py-4 font-semibold">{row.title}</td>
                <td className="px-5 py-4">
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                    {row.status}
                  </span>
                </td>
                <td className="px-5 py-4">
                  {formatMinorAmount(row.currentAmountMinor, row.currency)}
                </td>
                <td className="px-5 py-4">{row.bidCount}</td>
                <td className="px-5 py-4 text-xs text-slate-500">
                  {new Date(row.endsAt).toLocaleString("en-NP")}
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    {canManage && row.status === "LIVE" && (
                      <button
                        type="button"
                        disabled={action.isPending}
                        onClick={() => action.mutate({ id: row.id, kind: "PAUSE" })}
                        className="rounded border px-3 py-1.5 text-xs disabled:opacity-50"
                      >
                        Pause
                      </button>
                    )}
                    {canManage && row.status === "PAUSED" && (
                      <button
                        type="button"
                        disabled={action.isPending}
                        onClick={() => action.mutate({ id: row.id, kind: "RESUME" })}
                        className="rounded border px-3 py-1.5 text-xs disabled:opacity-50"
                      >
                        Resume
                      </button>
                    )}
                    {canManage &&
                      (["DRAFT", "SCHEDULED", "LIVE", "PAUSED"] as const).includes(
                        row.status as "DRAFT" | "SCHEDULED" | "LIVE" | "PAUSED",
                      ) && (
                      <button
                        type="button"
                        disabled={action.isPending}
                        onClick={() => action.mutate({ id: row.id, kind: "CANCEL" })}
                        className="rounded border border-red-200 px-3 py-1.5 text-xs text-red-700 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminPagination
        page={page}
        pageCount={query.data?.pageCount ?? 1}
        onPage={setPage}
      />
    </section>
  );
}
