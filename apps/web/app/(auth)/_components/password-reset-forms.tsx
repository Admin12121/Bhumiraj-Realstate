"use client"

import type { FormEvent } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { MailCheck } from "lucide-react"
import { authClient } from "@real-estate/auth/client"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { AuthFooterLink } from "./auth-shared"

const MINIMUM_PASSWORD_LENGTH = 10

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    const form = new FormData(event.currentTarget)
    const result = await authClient.requestPasswordReset({
      email: String(form.get("email")),
      redirectTo: `${globalThis.location.origin}/reset-password`,
    })
    setPending(false)
    if (result.error) {
      return toast.error(
        result.error.message || "Unable to request a password reset."
      )
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-5">
        <Alert>
          <MailCheck />
          <AlertTitle>Check your inbox</AlertTitle>
          <AlertDescription>
            If the account exists, a reset link is on its way. The response is
            deliberately identical for unknown addresses.
          </AlertDescription>
        </Alert>
        <AuthFooterLink prompt="Remembered it?" href="/sign-in" label="Return to sign in" />
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field>
        <FieldLabel htmlFor="reset-email">Email</FieldLabel>
        <Input
          id="reset-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="w-full"
        />
        <FieldDescription>
          We will send a link that expires in one hour.
        </FieldDescription>
      </Field>
      <Button type="submit" className="w-full" loading={pending}>
        Send reset link
      </Button>
      <AuthFooterLink prompt="Remembered it?" href="/sign-in" label="Return to sign in" />
    </form>
  )
}

export function ResetPasswordForm() {
  const router = useRouter()
  const search = useSearchParams()
  const token = search.get("token")
  const invalidToken = search.get("error") === "INVALID_TOKEN"
  const [pending, setPending] = useState(false)
  const [mismatch, setMismatch] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return
    const form = new FormData(event.currentTarget)
    const password = String(form.get("password"))
    if (password !== String(form.get("confirmation"))) {
      setMismatch(true)
      return
    }
    setMismatch(false)

    setPending(true)
    const result = await authClient.resetPassword({
      newPassword: password,
      token,
    })
    setPending(false)
    if (result.error) {
      return toast.error(
        result.error.message || "The reset link is invalid or expired."
      )
    }
    toast.success("Password updated. Sign in with your new password.")
    router.replace("/sign-in")
  }

  if (!token || invalidToken) {
    return (
      <div className="flex flex-col gap-5">
        <Alert variant="error">
          <AlertTitle>This link is invalid or expired</AlertTitle>
          <AlertDescription>
            Reset links can be used once and expire after an hour.
          </AlertDescription>
        </Alert>
        <Button className="w-full" render={<Link href="/forgot-password">Request another link</Link>} />
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="new-password">New password</FieldLabel>
        <Input
          id="new-password"
          name="password"
          type="password"
          required
          minLength={MINIMUM_PASSWORD_LENGTH}
          maxLength={128}
          autoComplete="new-password"
          className="w-full"
        />
        <FieldDescription>
          Use at least {MINIMUM_PASSWORD_LENGTH} characters.
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor="confirmation">Confirm new password</FieldLabel>
        <Input
          id="confirmation"
          name="confirmation"
          type="password"
          required
          minLength={MINIMUM_PASSWORD_LENGTH}
          maxLength={128}
          autoComplete="new-password"
          className="w-full"
          onChange={() => mismatch && setMismatch(false)}
        />
        {mismatch && (
          <p className="text-destructive-foreground text-xs">
            Passwords do not match.
          </p>
        )}
      </Field>

      <Button type="submit" className="w-full" loading={pending}>
        Reset password
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Resetting your password signs out every other device.
      </p>
    </form>
  )
}
