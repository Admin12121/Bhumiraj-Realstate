"use client"

import Link from "next/link"
import type { FormEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { signIn } from "@real-estate/auth/client"
import { toast } from "sonner"
import { safeReturnPath } from "@/shared/security/safe-return-path"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  AuthFooterLink,
  AuthProviders,
  AuthSeparator,
  ExistingSessionNotice,
} from "./auth-shared"

export function SignInForm() {
  const router = useRouter()
  const search = useSearchParams()
  const callbackURL = safeReturnPath(search.get("callbackURL"))
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    const form = new FormData(event.currentTarget)
    const result = await signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
      callbackURL,
    })
    setPending(false)
    if (result.error) {
      return toast.error(result.error.message || "Unable to sign in.")
    }

    const data = result.data as { twoFactorRedirect?: boolean } | null
    if (data?.twoFactorRedirect) {
      router.push(`/two-factor?callbackURL=${encodeURIComponent(callbackURL)}`)
      return
    }
    router.push(callbackURL)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-5">
      <ExistingSessionNotice callbackURL={callbackURL} />
      <AuthProviders callbackURL={callbackURL} disabled={pending} />
      <AuthSeparator />

      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full"
          />
        </Field>

        <Field>
          <div className="flex w-full items-center justify-between">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={10}
            maxLength={128}
            autoComplete="current-password"
            placeholder="Enter your password"
            className="w-full"
          />
        </Field>

        <Button type="submit" className="w-full" loading={pending}>
          Sign in
        </Button>
      </form>

      <AuthFooterLink
        prompt="New to Bhumiraj?"
        href="/sign-up"
        label="Create an account"
      />
      <p className="px-4 text-center text-xs text-muted-foreground">
        By continuing, you agree to the Terms of Service and Privacy Policy.
      </p>
    </div>
  )
}
