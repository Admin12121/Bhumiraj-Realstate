"use client";

import type { CSSProperties, ReactNode } from "react";
import { useSession } from "@real-estate/auth/client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { MarketplaceMobileNavigation } from "./mobile-bottom-navigation";

export function MarketplacePageShell({
  children,
  scrollable = true,
}: {
  children: ReactNode;
  scrollable?: boolean;
}) {
  const session = useSession();

  return (
    <SidebarProvider
      className="mx-auto flex h-dvh min-h-0 overflow-hidden"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 64)",
          "--header-height": "calc(var(--spacing) * 12 + 1px)",
        } as CSSProperties
      }
    >
      <AppSidebar
        authenticated={Boolean(session.data?.user)}
        name={session.data?.user.name}
      />
      <SidebarInset className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
        {scrollable ? (
          <div
            data-lenis-prevent
            className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain pb-24 min-[800px]:pb-0"
          >
            {children}
          </div>
        ) : (
          children
        )}
      </SidebarInset>
      <MarketplaceMobileNavigation />
    </SidebarProvider>
  );
}
