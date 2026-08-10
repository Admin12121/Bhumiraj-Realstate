"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { decideAdminListing, getAdminListings } from "../api/admin-api";
import { formatMinorAmount } from "@/shared/utilities/money";
import { AdminPagination } from "./admin-pagination";

export function AdminListingsTable() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("PENDING_REVIEW");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const query = useQuery({
    queryKey: ["admin", "listings", page, status, debouncedSearch],
    queryFn: () => getAdminListings(page, 25, status, debouncedSearch),
    placeholderData: (previous) => previous,
  });

  const decision = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "PUBLISH" | "REJECT" }) => {
      const reason = action === "REJECT" ? window.prompt("Reason for rejection:")?.trim() : undefined;
      if (action === "REJECT" && !reason) throw new Error("A rejection reason is required.");
      return decideAdminListing(id, action, reason);
    },
    onSuccess: async () => {
      toast.success("Listing moderation decision saved.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "listings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="surface overflow-hidden rounded-2xl">
      <div className="grid gap-3 border-b p-4 sm:grid-cols-[1fr_220px_auto] sm:items-center">
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search listing, slug or owner email"
          className="h-10 rounded-lg border px-3 text-sm"
        />
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className="h-10 rounded-lg border bg-white px-3 text-sm"
        >
          <option value="">All statuses</option>
          {["PENDING_REVIEW", "PUBLISHED", "REJECTED", "DRAFT", "WITHDRAWN"].map((item) => <option key={item}>{item}</option>)}
        </select>
        <span className="text-xs text-slate-500">{query.data?.total ?? 0} listings</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3">Listing</th>
              <th className="px-5 py-3">Owner</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Price</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Created</th>
              <th className="px-5 py-3 text-right">Moderation</th>
            </tr>
          </thead>
          <tbody>
            {query.data?.items.map((row) => (
              <tr key={row.id} className="border-t align-top">
                <td className="px-5 py-4"><p className="font-semibold">{row.title}</p><p className="text-xs text-slate-500">{row.slug}</p></td>
                <td className="px-5 py-4"><p>{row.owner.name}</p><p className="text-xs text-slate-500">{row.owner.email}</p></td>
                <td className="px-5 py-4">{row.type} · {row.propertyType}</td>
                <td className="px-5 py-4">{row.priceMinor ? formatMinorAmount(row.priceMinor, row.currency) : "Auction"}</td>
                <td className="px-5 py-4"><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">{row.status}</span></td>
                <td className="px-5 py-4 text-xs text-slate-500">{new Date(row.createdAt).toLocaleDateString()}</td>
                <td className="px-5 py-4 text-right">
                  {row.status === "PENDING_REVIEW" || row.status === "REJECTED" ? (
                    <div className="flex justify-end gap-2">
                      <button disabled={decision.isPending} onClick={() => decision.mutate({ id: row.id, action: "PUBLISH" })} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white">Publish</button>
                      <button disabled={decision.isPending} onClick={() => decision.mutate({ id: row.id, action: "REJECT" })} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700">Reject</button>
                    </div>
                  ) : <span className="text-xs text-slate-400">No action</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AdminPagination page={page} pageCount={query.data?.pageCount ?? 1} onPage={setPage} />
    </section>
  );
}

