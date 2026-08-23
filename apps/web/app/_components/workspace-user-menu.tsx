"use client";

import Link from "next/link";
import { CircleUserRound, EllipsisVertical, LogOut, Store } from "lucide-react";
import { signOut } from "@real-estate/auth/client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Menu,
  MenuGroup,
  MenuItem,
  MenuLinkItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function initialsOf(value: string): string {
  const parts = value.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "?";
}

/**
 * The footer identity block shared by the account and admin sidebars, so both
 * workspaces sign out and switch context the same way.
 */
export function WorkspaceUserMenu({
  name,
  email,
  image,
  badge,
  workspace,
}: {
  name: string;
  email: string;
  image?: string | null | undefined;
  /** Role or account-type chip shown under the name. */
  badge?: string | undefined;
  workspace: "account" | "admin";
}) {
  const { isMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Menu>
          <MenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-[popup-open]:bg-sidebar-accent data-[popup-open]:text-sidebar-accent-foreground"
              />
            }
          >
            <Avatar className="size-8 rounded-lg grayscale">
              {image ? <AvatarImage src={image} alt={name} /> : null}
              <AvatarFallback className="rounded-lg">
                {initialsOf(name || email)}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {badge ?? email}
              </span>
            </div>
            <EllipsisVertical className="ml-auto size-4" />
          </MenuTrigger>

          <MenuPopup
            align="end"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
            className="w-(--anchor-width) min-w-56 rounded-lg"
          >
            <MenuGroup>
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-muted p-2 text-left text-sm">
                <Avatar className="size-8 rounded-lg">
                  {image ? <AvatarImage src={image} alt={name} /> : null}
                  <AvatarFallback className="rounded-lg">
                    {initialsOf(name || email)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-medium">{name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {email}
                  </span>
                </div>
              </div>
            </MenuGroup>

            <MenuGroup>
              <MenuLinkItem
                render={
                  <Link
                    href={workspace === "admin" ? "/dashboard/account" : "/account/settings"}
                  />
                }
              >
                <CircleUserRound />
                Account
              </MenuLinkItem>
              <MenuLinkItem render={<Link href="/" />}>
                <Store />
                Marketplace
              </MenuLinkItem>
            </MenuGroup>

            <MenuSeparator />

            <MenuItem
              variant="destructive"
              onClick={() =>
                signOut({
                  fetchOptions: { onSuccess: () => location.assign("/") },
                })
              }
            >
              <LogOut />
              Log out
            </MenuItem>
          </MenuPopup>
        </Menu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
