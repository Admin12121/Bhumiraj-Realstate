import { Suspense } from "react"
import { AccountShell, InvitationCenter } from "../_components"

export default function InvitationsPage() {
  return (
    <AccountShell
      title="Platform invitation"
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
