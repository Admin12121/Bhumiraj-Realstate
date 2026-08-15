"use client";

import Link from "next/link";
import { ChevronDown, CircleUserRound, LogIn } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function NavUser({
  authenticated,
  name,
}: {
  authenticated: boolean;
  name?: string | null | undefined;
}) {
  if (!authenticated) {
    return (
      <Link
        href="/sign-in"
        className={cn(buttonVariants({ variant: "default" }), "w-full")}
      >
        <LogIn className="size-4" />
        Login
      </Link>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          className="h-12 rounded-xl"
          render={<Link href="/account/profile" />}
          size="lg"
          tooltip={name || "My account"}
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-emerald-50">
            <CircleUserRound className="size-5 text-emerald-800" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              {name || "My account"}
            </span>
            <span className="text-[11px] text-slate-500">View profile</span>
          </span>
          <ChevronDown className="ml-auto size-4" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
