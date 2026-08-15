"use client";

import Image from "next/image";
import Link from "next/link";
import type { ComponentProps } from "react";
import { HousePlus } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavMain } from "./nav-main";
import { NavSecondary } from "./nav-secondary";
import { NavUser } from "./nav-user";

export function AppSidebar({
  authenticated,
  name,
  style,
  ...props
}: ComponentProps<typeof Sidebar> & {
  authenticated: boolean;
  name?: string | null | undefined;
}) {
  return (
    <Sidebar collapsible="icon" style={style} {...props}>
      <SidebarHeader className="border-b">
        <SidebarMenu>
          <SidebarMenuItem className="flex flex-row gap-2">
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:!p-1.5"
              render={<Link href="/" />}
              tooltip="Bhumiraj Estates"
            >
              <Image
                src="/Bhumiraj Logo.png"
                alt="Bhumiraj Estates"
                width={32}
                height={32}
                className="rounded-md object-cover"
                priority
              />
              <span className="truncate text-base font-semibold text-[#07572f]">
                BHUMIRAJ
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="h-full gap-4">
        <NavMain authenticated={authenticated} />

        {authenticated ? (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <div className="rounded-2xl border border-emerald-200 p-4">
              <div className="mb-3 flex size-9 items-center justify-center ">
                <HousePlus className="size-5" />
              </div>
              <p className="font-semibold">List your property</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Reach verified buyers, renters, and agents.
              </p>
              <Link
                href="/post-property"
                className="brand-button mt-4 block rounded-lg px-4 py-2.5 text-center text-sm font-medium"
              >
                Post Property
              </Link>
            </div>
          </SidebarGroup>
        ) : null}

        <NavSecondary authenticated={authenticated} />
      </SidebarContent>

      <SidebarFooter className="border-t px-4 py-4">
        <NavUser authenticated={authenticated} name={name} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
