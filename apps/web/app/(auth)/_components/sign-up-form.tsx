"use client"

import Link from "next/link"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { signUp } from "@real-estate/auth/client"
import { notify } from "@/shared/feedback/notify"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldNote,
  FieldSeparator,
} from "@/components/ui/field"
import { Form } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  AuthFrame,
  ExistingSessionNotice,
  GoogleButton,
} from "./auth-shared"

const MINIMUM_PASSWORD_LENGTH = 10

export function SignUpForm() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get("password"))
    if (password !== String(form.get("confirm"))) {
      setError("Passwords do not match.")
      notify.warning("Passwords do not match.")
      return
    }
    setError(null)

    setPending(true)
    const result = await signUp.email({
      name: String(form.get("name")),
      email: String(form.get("email")),
      password,
      callbackURL: "/",
    })
    setPending(false)
    if (result.error) {
      const message = result.error.message || "We could not create the account."
      setError(message)
      notify.error(message)
      return
    }
    notify.success("Account created.", {
      description: "Check your email to verify it before signing in.",
    })
    router.push("/sign-in")
  }

  return (
    <AuthFrame bare>
      <Form onSubmit={submit}>
        <FieldGroup>
          <ExistingSessionNotice callbackURL="/" />
          <GoogleButton callbackURL="/" disabled={pending} label="Sign up with Google" />
          <FieldSeparator className="mt-1">Or</FieldSeparator>

          <Field>
            <FieldLabel htmlFor="name">Name</FieldLabel>
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
              placeholder="m@example.com"
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
              onChange={() => error && setError(null)}
            />
          </Field>

          {error && (
            <div role="alert" className="text-sm font-normal text-destructive">
              {error}
            </div>
          )}

          <Field className="space-y-1">
            <Button type="submit" className="w-full" loading={pending}>
              Create account
            </Button>
          </Field>

          <FieldNote className="text-center">
            Already have an account?{" "}
            <Link href="/sign-in" className="font-medium">
              Sign in
            </Link>
          </FieldNote>
        </FieldGroup>
      </Form>
    </AuthFrame>
  )
}
