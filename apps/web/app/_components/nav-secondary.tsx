"use client";

import * as React from "react";
import Link from "next/link";
import { CircleHelp, MoonStar } from "lucide-react";

import { AnimatedThemeToggler } from "@/components/animated-theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

function subscribe() {
  return () => {};
}

export function NavSecondary({ authenticated }: { authenticated: boolean }) {
  const mounted = React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  return (
    <SidebarGroup className="mt-auto">
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-10 rounded-xl px-3"
              render={
                <Link href={authenticated ? "/account/messages" : "/sign-in"} />
              }
              tooltip="Get Help"
            >
              <CircleHelp className="size-5" />
              <span>Get Help</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-10 cursor-default rounded-xl px-3 hover:bg-transparent active:bg-transparent group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:!p-0"
              render={<div />}
              tooltip="Mode"
            >
              <MoonStar className="size-5 group-data-[collapsible=icon]:hidden" />
              <span className="group-data-[collapsible=icon]:hidden">Mode</span>
              {mounted ? (
                <AnimatedThemeToggler
                  aria-label="Toggle dark mode"
                  className="ml-auto group-data-[collapsible=icon]:hidden"
                />
              ) : (
                <Skeleton className="ml-auto h-4 w-8 rounded-full group-data-[collapsible=icon]:mx-auto" />
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
