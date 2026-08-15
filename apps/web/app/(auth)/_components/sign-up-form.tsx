"use client"

import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { signUp } from "@real-estate/auth/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  AuthFooterLink,
  AuthProviders,
  AuthSeparator,
  ExistingSessionNotice,
} from "./auth-shared"

const MINIMUM_PASSWORD_LENGTH = 10

export function SignUpForm() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [mismatch, setMismatch] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get("password"))
    if (password !== String(form.get("confirm"))) {
      setMismatch(true)
      return
    }
    setMismatch(false)

    setPending(true)
    const result = await signUp.email({
      name: String(form.get("name")),
      email: String(form.get("email")),
      password,
      callbackURL: "/",
    })
    setPending(false)
    if (result.error) {
      return toast.error(result.error.message || "Registration failed.")
    }
    toast.success("Account created. Check your email to verify it.")
    router.push("/sign-in")
  }

  return (
    <div className="flex flex-col gap-5">
      <ExistingSessionNotice callbackURL="/" />
      {/* Passkeys are added from account security once an account exists. */}
      <AuthProviders callbackURL="/" disabled={pending} showPasskey={false} />
      <AuthSeparator />

      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="name">Full name</FieldLabel>
          <Input
            id="name"
            name="name"
            required
            minLength={2}
            maxLength={120}
            autoComplete="name"
            placeholder="Your full name"
            className="w-full"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="signup-email">Email</FieldLabel>
          <Input
            id="signup-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="signup-password">Password</FieldLabel>
          <Input
            id="signup-password"
            name="password"
            type="password"
            required
            minLength={MINIMUM_PASSWORD_LENGTH}
            maxLength={128}
            autoComplete="new-password"
            placeholder="Create a password"
            className="w-full"
          />
          <FieldDescription>
            Use at least {MINIMUM_PASSWORD_LENGTH} characters.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            required
            minLength={MINIMUM_PASSWORD_LENGTH}
            maxLength={128}
            autoComplete="new-password"
            placeholder="Repeat your password"
            className="w-full"
            onChange={() => mismatch && setMismatch(false)}
          />
          {mismatch && (
            <p className="text-destructive-foreground text-xs">
              Passwords do not match.
            </p>
          )}
        </Field>

        <div className="flex items-start gap-2">
          <Checkbox id="terms" name="terms" required className="mt-0.5" />
          <label htmlFor="terms" className="text-xs leading-5 text-muted-foreground">
            I agree to the Terms of Service and Privacy Policy.
          </label>
        </div>

        <Button type="submit" className="w-full" loading={pending}>
          Create account
        </Button>
      </form>

      <AuthFooterLink
        prompt="Already registered?"
        href="/sign-in"
        label="Sign in"
      />
    </div>
  )
}
