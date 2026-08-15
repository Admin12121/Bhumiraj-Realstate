"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type ReactNode } from "react"
import { Fingerprint } from "lucide-react"
import { toast } from "sonner"
import { signIn, signOut, useSession } from "@real-estate/auth/client"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

export function GoogleMark() {
  return (
    <svg className="size-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

/** Google and passkey entry points, shown above the credential form. */
export function AuthProviders({
  callbackURL,
  disabled,
  showPasskey = true,
}: {
  callbackURL: string
  disabled?: boolean
  showPasskey?: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState<"google" | "passkey" | null>(null)
  const busy = disabled || pending !== null

  async function withGoogle() {
    setPending("google")
    const result = await signIn.social({ provider: "google", callbackURL })
    if (result?.error) {
      setPending(null)
      toast.error(result.error.message || "Google sign-in is unavailable.")
    }
  }

  async function withPasskey() {
    setPending("passkey")
    const result = await signIn.passkey({ autoFill: false })
    setPending(null)
    if (result?.error) {
      return toast.error(result.error.message || "Passkey sign-in failed.")
    }
    router.push(callbackURL)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={busy}
        loading={pending === "google"}
        onClick={() => void withGoogle()}
      >
        <GoogleMark />
        Continue with Google
      </Button>
      {showPasskey && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={busy}
          loading={pending === "passkey"}
          onClick={() => void withPasskey()}
        >
          <Fingerprint />
          Continue with a passkey
        </Button>
      )}
    </div>
  )
}

export function AuthSeparator({ label = "Or" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <Separator className="flex-1" />
      <span className="text-xs text-muted-foreground">{label}</span>
      <Separator className="flex-1" />
    </div>
  )
}

/**
 * Shown when a session already exists on this browser. Without a way out, a
 * stale or foreign cookie leaves someone unable to reach a usable sign-in.
 */
export function ExistingSessionNotice({ callbackURL }: { callbackURL: string }) {
  const session = useSession()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const user = session.data?.user as
    | { name?: string | null; email?: string | null }
    | undefined
  if (!user) return null

  return (
    <div className="mb-5 rounded-xl border bg-muted/40 p-4">
      <p className="text-sm">
        Already signed in as{" "}
        <span className="font-semibold">{user.email || user.name}</span>.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => router.push(callbackURL)}>
          Continue
        </Button>
        <Button
          size="sm"
          variant="outline"
          loading={signingOut}
          onClick={async () => {
            setSigningOut(true)
            await signOut()
            setSigningOut(false)
            router.refresh()
          }}
        >
          Use another account
        </Button>
      </div>
    </div>
  )
}

export function AuthFooterLink({
  prompt,
  href,
  label,
}: {
  prompt: string
  href: string
  label: ReactNode
}) {
  return (
    <p className="text-center text-sm text-muted-foreground">
      {prompt}{" "}
      <Link href={href} className="font-semibold text-emerald-700 underline-offset-4 hover:underline">
        {label}
      </Link>
    </p>
  )
}
