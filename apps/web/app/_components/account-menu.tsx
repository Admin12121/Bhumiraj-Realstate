"use client"

import Link from "next/link"
import {
  Bell,
  Bookmark,
  Handshake,
  LayoutDashboard,
  LogOut,
  UserRound,
} from "lucide-react"
import { signOut, useSession } from "@real-estate/auth/client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Menu,
  MenuGroup,
  MenuLinkItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu"
import { MenuItem } from "@/components/ui/menu"
import { useAgentSummary } from "@/features/listings/queries/use-agent-workspace"
import { cn } from "@/lib/utils"

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "?"
}

/** Avatar trigger plus the signed-in destinations, in the shared Menu. */
export function AccountMenu({ inverse = false }: { inverse?: boolean }) {
  const session = useSession()
  const agent = useAgentSummary()

  const user = session.data?.user
  if (!user) return null

  const isAgent = agent.data?.isAgent === true
  const isStaff = user.role === "OWNER" || user.role === "STAFF"

  return (
    <Menu>
      <MenuTrigger
        render={
          <button
            type="button"
            aria-label="Account menu"
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-full transition-colors",
              inverse ? "hover:bg-white/10" : "hover:bg-black/[.05]",
            )}
          />
        }
      >
        <Avatar className="size-8">
          {user.image ? <AvatarImage src={user.image} alt="" /> : null}
          <AvatarFallback className="bg-[#efece9] text-[13px] font-semibold text-[#5b524c]">
            {initials(user.name || user.email || "?")}
          </AvatarFallback>
        </Avatar>
      </MenuTrigger>

      <MenuPopup align="end" sideOffset={4} className="min-w-56 rounded-lg">
        <MenuGroup>
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-muted p-2 text-left text-sm">
            <Avatar className="size-8 rounded-lg">
              {user.image ? <AvatarImage src={user.image} alt="" /> : null}
              <AvatarFallback className="rounded-lg bg-[#efece9] text-[13px] font-semibold text-[#5b524c]">
                {initials(user.name || user.email || "?")}
              </AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 leading-tight">
              <span className="truncate font-medium">
                {user.name || "Your account"}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>
          </div>
        </MenuGroup>

        {/* The handful of places people actually revisit. Staff get the console
            in place of the customer dashboard; everything else is shared. */}
        <MenuGroup>
          <MenuLinkItem render={<Link href={isStaff ? "/dashboard" : "/account"} />}>
            <LayoutDashboard />
            Dashboard
          </MenuLinkItem>
          <MenuLinkItem render={<Link href="/account/settings" />}>
            <UserRound />
            Profile
          </MenuLinkItem>
          <MenuLinkItem render={<Link href="/account/saved" />}>
            <Bookmark />
            Saved
          </MenuLinkItem>
          <MenuLinkItem render={<Link href="/account/alerts" />}>
            <Bell />
            Notifications
          </MenuLinkItem>
          {isAgent ? (
            <MenuLinkItem render={<Link href="/account/offers" />}>
              <Handshake />
              Property offers
            </MenuLinkItem>
          ) : null}
        </MenuGroup>

        <MenuSeparator />

        <MenuItem
          variant="destructive"
          onClick={() =>
            signOut({ fetchOptions: { onSuccess: () => location.assign("/") } })
          }
        >
          <LogOut />
          Log out
        </MenuItem>
      </MenuPopup>
    </Menu>
  )
}
