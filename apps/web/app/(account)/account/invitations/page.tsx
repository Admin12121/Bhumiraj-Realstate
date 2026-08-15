import { Suspense } from "react"
import { AccountShell, InvitationCenter } from "../_components"

export default function InvitationsPage() {
  return (
    <AccountShell
      title="Platform invitation"
      description="Accept a staff or agent invitation sent to your verified email."
    >
      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">Loading invitation...</p>
        }
      >
        <InvitationCenter />
      </Suspense>
    </AccountShell>
  )
}
