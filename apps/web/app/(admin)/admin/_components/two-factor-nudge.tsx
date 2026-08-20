"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ShieldCheck, X } from "lucide-react"
import { useSession } from "@real-estate/auth/client"
import { Button } from "@/components/ui/button"

const DISMISS_KEY = "bhumiraj.admin.2fa-nudge-dismissed"

/**
 * Invites staff to add a second factor without gating anything on it.
 * Administration itself stays reachable with a password session; only
 * authority-changing actions ask for step-up when they are attempted.
 */
export function TwoFactorNudge() {
  const session = useSession()
  // Read on mount rather than during render so the server and first client
  // pass agree, and so the effect never sets state synchronously.
  const [dismissed, setDismissed] = useState<boolean | null>(null)

  useEffect(() => {
    const stored = window.localStorage.getItem(DISMISS_KEY) === "true"
    const timer = window.setTimeout(() => setDismissed(stored), 0)
    return () => window.clearTimeout(timer)
  }, [])

  const user = session.data?.user as { twoFactorEnabled?: boolean } | undefined
  if (dismissed !== false || !user || user.twoFactorEnabled) return null

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
      <ShieldCheck className="size-5 shrink-0 text-emerald-700" />
      <p className="flex-1 text-sm text-emerald-900">
        Add a passkey or authenticator app so you are not interrupted when you
        change roles, staff or auctions. You can keep working without it.
      </p>
      <Button size="sm" render={<Link href="/admin/account">Set it up</Link>} />
      <Button
        size="icon"
        variant="ghost"
        aria-label="Dismiss two-factor reminder"
        onClick={() => {
          window.localStorage.setItem(DISMISS_KEY, "true")
          setDismissed(true)
        }}
      >
        <X />
      </Button>
    </div>
  )
}
