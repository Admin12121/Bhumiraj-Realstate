"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type ReactNode } from "react"
import { notify } from "@/shared/feedback/notify"
import { signIn, signOut, useSession } from "@real-estate/auth/client"
import { Button } from "@/components/ui/button"
import { CardPanel } from "@/components/ui/card"
import { Field, FieldNote } from "@/components/ui/field"
import { Frame } from "@/components/ui/frame"

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

/**
 * The card the reference project puts its auth forms in: a bare frame with the
 * mark on top, the form inside, and the terms note sitting outside the card.
 */
export function AuthFrame({
  children,
  note = "By continuing, you agree to the Terms of Service and Privacy Policy.",
  bare = false,
}: {
  children: ReactNode
  note?: ReactNode
  /** Inside the split layout the logo and heading already exist above. */
  bare?: boolean
}) {
  if (bare) {
    return (
      <div className="flex w-full flex-col gap-6">
        {children}
        <FieldNote className="text-center">{note}</FieldNote>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <Frame className="border-none py-5">
        <div className="mb-5 text-center">
          <Link
            href="/"
            className="flex flex-col items-center gap-2 self-center"
            aria-label="Bhumiraj Estates home"
          >
            <Image
              src="/Logo.webp"
              alt=""
              width={56}
              height={56}
              className="size-14 rounded-lg object-contain"
            />
          </Link>
        </div>
        <CardPanel className="px-4 py-0">{children}</CardPanel>
      </Frame>
      <FieldNote className="px-6 text-center">{note}</FieldNote>
    </div>
  )
}

/**
 * Google is the only social provider. Passkeys are deliberately not offered
 * here: they are a second factor, presented at verification time, not a way
 * to skip the first one.
 */
export function GoogleButton({
  callbackURL,
  disabled,
  label = "Continue with Google",
}: {
  callbackURL: string
  disabled?: boolean
  label?: string
}) {
  const [pending, setPending] = useState(false)

  async function withGoogle() {
    setPending(true)
    const result = await signIn.social({ provider: "google", callbackURL })
    if (result?.error) {
      setPending(false)
      notify.error(result.error.message || "Google sign-in is unavailable.")
    }
  }

  return (
    <Field>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={disabled}
        loading={pending}
        onClick={() => void withGoogle()}
      >
        <GoogleMark />
        {label}
      </Button>
    </Field>
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
    <div className="rounded-xl border bg-muted/40 p-4">
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
