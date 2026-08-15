"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

import {
  authenticatedMarketplaceNavigation,
  guestMarketplaceNavigation,
  isActivePath,
} from "./navigation-model";

export function NavMain({ authenticated }: { authenticated: boolean }) {
  const pathname = usePathname();
  const navigation = authenticated
    ? authenticatedMarketplaceNavigation
    : guestMarketplaceNavigation;

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <nav aria-label="Primary navigation">
          <SidebarMenu>
            {navigation.map((item) => {
              const Icon = item.icon;

              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    className="h-11 rounded-xl px-3"
                    isActive={isActivePath(pathname, item.href)}
                    render={<Link href={item.href} />}
                    tooltip={item.label}
                  >
                    <Icon className="size-5" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </nav>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
