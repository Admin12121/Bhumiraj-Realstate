"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import {
  banAdminUser,
  getAdminUsers,
  setAdminUserRole,
  unbanAdminUser,
} from "../api/admin-api";
import { queryKeys } from "@/shared/query/query-keys";
import { toast } from "sonner";

const roles = ["USER", "AGENT", "MODERATOR", "ADMIN", "SUPER_ADMIN"];

export function AdminUsersTable() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filters = { search: debouncedSearch, role, status };
  const query = useQuery({
    queryKey: queryKeys.adminUsers(page, filters),
    queryFn: () => getAdminUsers(page, 25, debouncedSearch, role, status),
    placeholderData: (previous) => previous,
  });

  const action = useMutation({
    mutationFn: async (input: {
      id: string;
      kind: "role" | "ban" | "unban";
      role?: string;
    }) => {
      if (input.kind === "role") return setAdminUserRole(input.id, input.role!);
      if (input.kind === "ban") {
        const reason = window.prompt("Reason for suspension:")?.trim();
        if (!reason) throw new Error("A suspension reason is required.");
        return banAdminUser(input.id, reason);
      }
      return unbanAdminUser(input.id);
    },
    onSuccess: async () => {
      toast.success("User account updated.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="surface overflow-hidden rounded-2xl">
      <div className="grid gap-3 border-b p-4 md:grid-cols-[1fr_180px_160px_auto] md:items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search name or email"
            className="h-10 w-full rounded-lg border pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={role}
          onChange={(event) => {
            setRole(event.target.value);
            setPage(1);
          }}
          className="h-10 rounded-lg border bg-white px-3 text-sm"
        >
          <option value="">All roles</option>
          {roles.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className="h-10 rounded-lg border bg-white px-3 text-sm"
        >
          <option value="">All accounts</option>
          <option value="active">Active</option>
          <option value="banned">Suspended</option>
        </select>
        <span className="text-xs text-slate-500">{query.data?.total ?? 0} users</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3">User</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Security</th>
              <th className="px-5 py-3">Listings</th>
              <th className="px-5 py-3">Lifecycle</th>
              <th className="px-5 py-3">Joined</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {query.data?.items.map((user) => (
              <tr key={user.id} className="border-t align-top">
                <td className="px-5 py-4">
                  <p className="font-semibold">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </td>
                <td className="px-5 py-4">
                  <select
                    aria-label={`Role for ${user.email}`}
                    value={user.role}
                    disabled={action.isPending}
                    onChange={(event) =>
                      action.mutate({
                        id: user.id,
                        kind: "role",
                        role: event.target.value,
                      })
                    }
                    className="h-9 rounded-lg border bg-white px-2 text-xs font-semibold"
                  >
                    {roles.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </td>
                <td className="px-5 py-4 text-xs leading-5">
                  {user.emailVerified ? "Email verified" : "Unverified"}
                  <br />
                  {user.twoFactorEnabled ? "2FA enabled" : "2FA disabled"}
                </td>
                <td className="px-5 py-4">{user.listings}</td>
                <td className="px-5 py-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      user.banned || user.lifecycleStatus !== "ACTIVE"
                        ? "bg-red-50 text-red-700"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {user.banned ? "SUSPENDED" : user.lifecycleStatus}
                  </span>
                </td>
                <td className="px-5 py-4 text-xs text-slate-500">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-5 py-4 text-right">
                  <button
                    aria-label={`${user.banned ? "Restore" : "Suspend"} ${user.email}`}
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({
                        id: user.id,
                        kind: user.banned ? "unban" : "ban",
                      })
                    }
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                      user.banned
                        ? "border-emerald-200 text-emerald-700"
                        : "border-red-200 text-red-700"
                    }`}
                  >
                    {user.banned ? "Restore" : "Suspend"}
                  </button>
                </td>
              </tr>
            ))}
            {query.isLoading && (
              <tr><td colSpan={7} className="p-10 text-center text-slate-500">Loading users…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={query.data?.page ?? page}
        pageCount={query.data?.pageCount ?? 1}
        onPage={setPage}
      />
    </section>
  );
}

function Pagination({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-t px-5 py-4">
      <span className="text-xs text-slate-500">Page {page} of {Math.max(pageCount, 1)}</span>
      <div className="flex gap-2">
        <button aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-lg border p-2 disabled:opacity-40"><ChevronLeft className="size-4" /></button>
        <button aria-label="Next page" disabled={page >= pageCount} onClick={() => onPage(page + 1)} className="rounded-lg border p-2 disabled:opacity-40"><ChevronRight className="size-4" /></button>
      </div>
    </div>
  );
}
