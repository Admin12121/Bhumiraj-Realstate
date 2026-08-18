"use client"

import Link from "next/link"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { signIn } from "@real-estate/auth/client"
import { notify } from "@/shared/feedback/notify"
import { Button } from "@/components/ui/button"
import {
  Field,
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

export function SignInForm({ callbackURL }: { callbackURL: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)
    const form = new FormData(event.currentTarget)
    const result = await signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
      callbackURL,
    })
    setPending(false)
    if (result.error) {
      const message =
        result.error.message ||
        "We could not sign you in. Check your email and password."
      setError(message)
      notify.error(message)
      return
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
    <AuthFrame bare>
      <Form onSubmit={submit}>
        <FieldGroup>
          <ExistingSessionNotice callbackURL={callbackURL} />
          <GoogleButton callbackURL={callbackURL} disabled={pending} />
          <FieldSeparator className="mt-1">Or</FieldSeparator>

          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="m@example.com"
              className="w-full"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              required
              maxLength={128}
              autoComplete="current-password"
              placeholder="Enter your password"
              className="w-full"
            />
          </Field>
          <div className="-mt-3 flex justify-end">
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          {error && (
            <div role="alert" className="text-sm font-normal text-destructive">
              {error}
            </div>
          )}

          <Field className="space-y-1">
            <Button type="submit" className="w-full" loading={pending}>
              Sign in
            </Button>
          </Field>

          <FieldNote className="text-center">
            Don&apos;t have an account?{" "}
            <Link href="/sign-up" className="font-medium">
              Sign up
            </Link>
          </FieldNote>
        </FieldGroup>
      </Form>
    </AuthFrame>
  )
}
