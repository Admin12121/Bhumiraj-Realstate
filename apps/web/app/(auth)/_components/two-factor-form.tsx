"use client"

import type { FormEvent } from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Fingerprint, KeyRound, ShieldCheck } from "lucide-react"
import { authClient } from "@real-estate/auth/client"
import { notify } from "@/shared/feedback/notify"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { OTPField, OTPFieldInput } from "@/components/ui/otp-field"

type Method = "totp" | "backup" | "passkey"

const TOTP_LENGTH = 6

export function TwoFactorForm({ callbackURL }: { callbackURL: string }) {
  const router = useRouter()
  const [method, setMethod] = useState<Method>("totp")
  const [code, setCode] = useState("")
  const [pending, setPending] = useState(false)

  function succeed() {
    router.push(callbackURL)
    router.refresh()
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    const result =
      method === "backup"
        ? await authClient.twoFactor.verifyBackupCode({
            code,
            trustDevice: true,
          })
        : await authClient.twoFactor.verifyTotp({ code, trustDevice: true })
    setPending(false)
    if (result.error) {
      return notify.error(
        result.error.message || "That code was not accepted."
      )
    }
    succeed()
  }

  async function withPasskey() {
    setPending(true)
    const result = await authClient.signIn.passkey({ autoFill: false })
    setPending(false)
    if (result?.error) {
      return notify.error(
        result.error.message || "Passkey verification failed."
      )
    }
    succeed()
  }

  if (method === "passkey") {
    return (
      <div className="flex flex-col gap-5">
        <Button className="w-full" loading={pending} onClick={() => void withPasskey()}>
          <Fingerprint />
          Verify with a passkey
        </Button>
        <FieldSeparator>Or</FieldSeparator>
        <MethodChooser current={method} onChoose={setMethod} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={submit} className="flex flex-col gap-4">
        {method === "totp" ? (
          <Field>
            <FieldLabel>Authenticator code</FieldLabel>
            <OTPField
              size="lg"
              value={code}
              onValueChange={setCode}
              length={TOTP_LENGTH}
              autoFocus
              className="w-full justify-between"
            >
              {Array.from({ length: TOTP_LENGTH }, (_, index) => (
                <OTPFieldInput key={index} />
              ))}
            </OTPField>
            <FieldDescription>
              Open your authenticator app and enter the current six-digit code.
            </FieldDescription>
          </Field>
        ) : (
          <Field>
            <FieldLabel htmlFor="backup-code">Backup code</FieldLabel>
            <Input
              id="backup-code"
              autoFocus
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="one-time-code"
              placeholder="Enter a saved backup code"
              className="w-full font-mono"
            />
            <FieldDescription>
              Each backup code works once. Generate new ones afterwards.
            </FieldDescription>
          </Field>
        )}

        <Button
          type="submit"
          className="w-full"
          loading={pending}
          disabled={code.trim().length < TOTP_LENGTH}
        >
          Verify and continue
        </Button>
      </form>

      <FieldSeparator>Or</FieldSeparator>
      <MethodChooser current={method} onChoose={setMethod} />
    </div>
  )
}

function MethodChooser({
  current,
  onChoose,
}: {
  current: Method
  onChoose: (method: Method) => void
}) {
  const options: Array<{ id: Method; label: string; icon: typeof ShieldCheck }> = [
    { id: "totp", label: "Use an authenticator code", icon: ShieldCheck },
    { id: "backup", label: "Use a backup code", icon: KeyRound },
    { id: "passkey", label: "Use a passkey", icon: Fingerprint },
  ]

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">Try another way</p>
      {options
        .filter((option) => option.id !== current)
        .map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            type="button"
            variant="outline"
            className="w-full justify-start"
            onClick={() => onChoose(id)}
          >
            <Icon />
            {label}
          </Button>
        ))}
    </div>
  )
}
