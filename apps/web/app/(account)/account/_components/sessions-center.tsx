"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Laptop, LogOut, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { getSessions, revokeSession } from "@/features/account/api/account-api";

const sessionsKey = ["account", "sessions"] as const;

function deviceIcon(userAgent: string | null) {
  return userAgent && /mobile|android|iphone/i.test(userAgent) ? Smartphone : Laptop;
}

export function SessionsCenter() {
  const queryClient = useQueryClient();
  const sessions = useQuery({ queryKey: sessionsKey, queryFn: getSessions });
  const revoke = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => {
      toast.success("Session revoked");
      queryClient.invalidateQueries({ queryKey: sessionsKey });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="surface overflow-hidden rounded-2xl">
      <div className="border-b p-5">
        <h2 className="font-semibold">Signed-in devices</h2>
        <p className="mt-1 text-sm text-slate-500">
          Revoke sessions you do not recognize. The current browser is identified when the
          session token is available to the API.
        </p>
      </div>
      <div className="divide-y">
        {sessions.data?.map((session) => {
          const Icon = deviceIcon(session.userAgent);
          return (
            <div key={session.id} className="flex items-start gap-4 p-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{session.userAgent || "Unknown device"}</p>
                  {session.current && (
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                      CURRENT
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {session.ipAddress || "Unknown IP"} Â· Created {new Date(session.createdAt).toLocaleString()} Â· Expires {new Date(session.expiresAt).toLocaleString()}
                </p>
              </div>
              {!session.current && (
                <button
                  type="button"
                  onClick={() => revoke.mutate(session.id)}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold text-red-700"
                >
                  <LogOut className="size-3.5" /> Revoke
                </button>
              )}
            </div>
          );
        })}
        {sessions.isLoading && (
          <p className="p-8 text-center text-sm text-slate-500">Loading sessionsâ€¦</p>
        )}
        {!sessions.isLoading && !sessions.data?.length && (
          <p className="p-8 text-center text-sm text-slate-500">No active sessions found.</p>
        )}
      </div>
    </section>
  );
}
