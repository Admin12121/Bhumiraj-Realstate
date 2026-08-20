"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Trash2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { savedSearchSchema } from "@real-estate/contracts";
import { apiRequest } from "@/shared/http/api";
import { useConfirm } from "@/shared/components/confirm-dialog";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { errorMessage } from "@/shared/http/error-message";

const savedSearchListSchema = z.array(savedSearchSchema);
const deletedSchema = z.object({ deleted: z.boolean() });

function filterSummary(filters: Record<string, unknown>): string {
  const labels: string[] = [];
  if (typeof filters.q === "string" && filters.q) labels.push(`“${filters.q}”`);
  if (typeof filters.type === "string") labels.push(filters.type.toLowerCase());
  if (typeof filters.propertyType === "string") {
    labels.push(filters.propertyType.toLowerCase());
  }
  if (typeof filters.district === "string" && filters.district) {
    labels.push(filters.district);
  }
  if (typeof filters.bedrooms === "number") {
    labels.push(`${filters.bedrooms}+ bedrooms`);
  }
  return labels.length ? labels.join(" · ") : "All matching properties";
}

export function AlertsCenter() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const query = useQuery({
    queryKey: ["saved-searches"],
    queryFn: () =>
      apiRequest("/saved-searches", {
        method: "GET",
        schema: savedSearchListSchema,
      }),
  });

  const toggle = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/saved-searches/${id}/toggle-alerts`, {
        method: "PATCH",
        schema: savedSearchSchema,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData<z.infer<typeof savedSearchListSchema>>(
        ["saved-searches"],
        (current) =>
          current?.map((item) => (item.id === updated.id ? updated : item)),
      );
      toast.success(updated.alertsEnabled ? "Search alerts enabled" : "Search alerts disabled");
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/saved-searches/${id}`, {
        method: "DELETE",
        schema: deletedSchema,
      }).then(() => id),
    onSuccess: (id) => {
      queryClient.setQueryData<z.infer<typeof savedSearchListSchema>>(
        ["saved-searches"],
        (current) => current?.filter((item) => item.id !== id),
      );
      toast.success("Saved search deleted");
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  });

  if (query.isLoading) {
    return <div className="surface rounded-2xl p-8 text-sm text-slate-500">Loading saved searches…</div>;
  }
  if (query.isError) {
    return <div className="surface rounded-2xl p-8 text-sm text-red-600">Unable to load saved searches.</div>;
  }

  return (
    <div className="space-y-3">
      {query.data?.map((item) => (
        <article
          key={item.id}
          className="surface flex flex-col justify-between gap-4 rounded-2xl p-5 sm:flex-row sm:items-center"
        >
          <div className="min-w-0">
            <h2 className="font-semibold">{item.name}</h2>
            <p className="mt-1 truncate text-xs text-slate-500">
              {filterSummary(item.filters)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Created {new Date(item.createdAt).toLocaleDateString("en-NP")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={toggle.isPending || remove.isPending}
              onClick={() => toggle.mutate(item.id)}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold disabled:opacity-50 ${
                item.alertsEnabled
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {item.alertsEnabled ? (
                <Bell className="size-3.5" />
              ) : (
                <BellOff className="size-3.5" />
              )}
              {item.alertsEnabled ? "Alerts on" : "Alerts off"}
            </button>
            <button
              type="button"
              aria-label={`Delete ${item.name}`}
              disabled={toggle.isPending || remove.isPending}
              onClick={() =>
                confirm.ask({
                  title: "Delete saved search",
                  description: `“${item.name}” and its alerts will be removed.`,
                  confirmLabel: "Delete",
                  destructive: true,
                  onConfirm: () => remove.mutate(item.id),
                })
              }
              className="rounded-full border border-red-100 p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </article>
      ))}

      {!query.data?.length && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Bell />
            </EmptyMedia>
            <EmptyTitle>No alerts set up</EmptyTitle>
            <EmptyDescription>
              Save a search and turn on alerts to hear about new matches.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button render={<Link href="/search?type=SALE" />} size="sm">
              Start a search
            </Button>
          </EmptyContent>
        </Empty>
      )}
      {confirm.dialog}
    </div>
  );
}
