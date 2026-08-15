"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Laptop, LogOut, Smartphone } from "lucide-react"
import { toast } from "sonner"
import { getSessions, revokeSession } from "@/features/account/api/account-api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const sessionsKey = ["account", "sessions"] as const

function deviceIcon(userAgent: string | null) {
  return userAgent && /mobile|android|iphone/i.test(userAgent)
    ? Smartphone
    : Laptop
}

/** Trims a user agent to something a person can recognise at a glance. */
function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return "Unknown device"
  const browser = /edg\//i.test(userAgent)
    ? "Edge"
    : /chrome\//i.test(userAgent)
      ? "Chrome"
      : /safari\//i.test(userAgent)
        ? "Safari"
        : /firefox\//i.test(userAgent)
          ? "Firefox"
          : "Browser"
  const platform = /windows/i.test(userAgent)
    ? "Windows"
    : /android/i.test(userAgent)
      ? "Android"
      : /iphone|ipad|ios/i.test(userAgent)
        ? "iOS"
        : /mac os/i.test(userAgent)
          ? "macOS"
          : /linux/i.test(userAgent)
            ? "Linux"
            : "Unknown platform"
  return `${browser} on ${platform}`
}

export function SessionsCenter() {
  const queryClient = useQueryClient()
  const sessions = useQuery({ queryKey: sessionsKey, queryFn: getSessions })
  const revoke = useMutation({
    mutationFn: revokeSession,
    onSuccess: async () => {
      toast.success("Session revoked.")
      await queryClient.invalidateQueries({ queryKey: sessionsKey })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const items = sessions.data ?? []

  return (
    <section className="surface overflow-hidden rounded-2xl">
      <div className="border-b p-5">
        <h2 className="font-semibold">Signed-in devices</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Revoke anything you do not recognise. Revoking signs that device out
          immediately.
        </p>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-5">Device</TableHead>
              <TableHead>IP address</TableHead>
              <TableHead>Signed in</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="px-5 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((session) => {
              const Icon = deviceIcon(session.userAgent)
              return (
                <TableRow key={session.id}>
                  <TableCell className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium">
                          {deviceLabel(session.userAgent)}
                        </p>
                        {session.current && (
                          <Badge size="sm" variant="success" className="mt-1">
                            This device
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {session.ipAddress || "Unknown"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(session.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(session.expiresAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="px-5 text-right">
                    {!session.current && (
                      <Button
                        size="sm"
                        variant="destructive-outline"
                        loading={revoke.isPending}
                        onClick={() => revoke.mutate(session.id)}
                      >
                        <LogOut />
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {sessions.isLoading && (
        <p className="p-8 text-center text-sm text-muted-foreground">
          Loading sessions…
        </p>
      )}
      {!sessions.isLoading && items.length === 0 && (
        <p className="p-8 text-center text-sm text-muted-foreground">
          No active sessions found.
        </p>
      )}
    </section>
  )
}
