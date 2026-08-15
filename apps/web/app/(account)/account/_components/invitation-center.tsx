"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { CheckCircle2, MailCheck, TriangleAlert } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { acceptPlatformInvitation } from "@/features/account/api/account-api"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export function InvitationCenter() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const [acceptedType, setAcceptedType] = useState<"STAFF" | "AGENT" | null>(
    null
  )
  const accept = useMutation({
    mutationFn: () => acceptPlatformInvitation(token),
    onSuccess: (result) => setAcceptedType(result.accountType),
  })

  if (!token) {
    return (
      <Alert variant="warning">
        <TriangleAlert />
        <AlertTitle>Invitation token missing</AlertTitle>
        <AlertDescription>
          Open the complete invitation link sent by the platform administrator.
        </AlertDescription>
      </Alert>
    )
  }

  if (acceptedType) {
    return (
      <Alert variant="success">
        <CheckCircle2 />
        <AlertTitle>
          {acceptedType === "STAFF" ? "Staff" : "Agent"} invitation accepted
        </AlertTitle>
        <AlertDescription>
          Your account access has changed and all existing sessions were closed.
          Sign in again to continue.
          <Button className="mt-4" onClick={() => location.assign("/sign-in")}>
            Sign in again
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <section className="surface max-w-2xl rounded-2xl p-6">
      <MailCheck className="size-9 text-primary" />
      <h2 className="mt-4 text-xl font-semibold">Accept platform invitation</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        The invitation will be accepted only when your signed-in, verified email
        matches its recipient. Your current sessions will then be closed so the
        new account type takes effect safely.
      </p>
      {accept.isError && (
        <Alert variant="error" className="mt-5">
          <TriangleAlert />
          <AlertTitle>Invitation could not be accepted</AlertTitle>
          <AlertDescription>{accept.error.message}</AlertDescription>
        </Alert>
      )}
      <Button
        className="mt-6"
        loading={accept.isPending}
        onClick={() => accept.mutate()}
      >
        Accept invitation
      </Button>
    </section>
  )
}
