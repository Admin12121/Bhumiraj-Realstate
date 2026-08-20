"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { KeyRound, Link2, Unlink } from "lucide-react"
import { toast } from "sonner"
import { authClient } from "@real-estate/auth/client"
import { GoogleMark } from "@/app/(auth)/_components/auth-shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type LinkedAccount = { id: string; providerId: string; accountId: string }

const accountsKey = ["account", "connections"] as const

/**
 * Google is the only social provider offered. Password ("credential") is listed
 * too so the panel shows every way into the account, not just the social ones.
 */
export function ConnectedAccounts() {
  const queryClient = useQueryClient()

  const accounts = useQuery({
    queryKey: accountsKey,
    queryFn: async (): Promise<LinkedAccount[]> => {
      const result = await authClient.listAccounts()
      if (result.error) {
        throw new Error(result.error.message || "Could not load connections")
      }
      return (result.data ?? []) as LinkedAccount[]
    },
  })

  const unlink = useMutation({
    mutationFn: async (providerId: string) => {
      const result = await authClient.unlinkAccount({ providerId })
      if (result.error) {
        throw new Error(result.error.message || "Could not disconnect")
      }
    },
    onSuccess: async () => {
      toast.success("Account disconnected.")
      await queryClient.invalidateQueries({ queryKey: accountsKey })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const linked = accounts.data ?? []
  const google = linked.find(({ providerId }) => providerId === "google")
  const hasPassword = linked.some(
    ({ providerId }) => providerId === "credential"
  )
  // Removing the last way in would lock the account out entirely.
  const canUnlinkGoogle = Boolean(google) && hasPassword

  return (
    <section className="surface overflow-hidden rounded-2xl">
      <div className="border-b p-5">
        <h2 className="font-semibold">Connected accounts</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ways you can sign in. Keep at least one available.
        </p>
      </div>

      <div className="divide-y">
        <div className="flex flex-wrap items-center gap-4 p-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-background">
            <GoogleMark />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Google</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {google
                ? "Connected. You can sign in with one tap."
                : "Not connected."}
            </p>
          </div>
          {google ? (
            <Button
              size="sm"
              variant="destructive-outline"
              disabled={!canUnlinkGoogle}
              loading={unlink.isPending}
              onClick={() => unlink.mutate("google")}
            >
              <Unlink />
              Disconnect
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void authClient.linkSocial({
                  provider: "google",
                  callbackURL: "/account/settings?tab=security",
                })
              }
            >
              <Link2 />
              Connect
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 p-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-background text-muted-foreground">
            <KeyRound className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Password</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {hasPassword
                ? "Set. Use the password reset flow to change it."
                : "Not set. Add one so you are not reliant on Google alone."}
            </p>
          </div>
          <Badge variant={hasPassword ? "success" : "secondary"}>
            {hasPassword ? "Active" : "Not set"}
          </Badge>
        </div>
      </div>

      {google && !hasPassword && (
        <p className="border-t bg-muted/40 p-4 text-xs text-muted-foreground">
          Google is currently your only way in, so it cannot be disconnected.
          Set a password first.
        </p>
      )}
      {accounts.isLoading && (
        <p className="p-8 text-center text-sm text-muted-foreground">
          Loading connections…
        </p>
      )}
    </section>
  )
}
