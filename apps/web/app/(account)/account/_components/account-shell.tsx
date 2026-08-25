"use client";

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, LayoutDashboard } from "lucide-react";
import { useSession } from "@real-estate/auth/client";

import { MarketplaceMobileNavigation } from "@/app/_components/mobile-bottom-navigation";
import {
  accountNavigation,
  accountSystemNavigation,
  agentNavigation,
  isActivePath,
  type NavigationItem,
} from "@/app/_components/navigation-model";
import { WorkspaceUserMenu } from "@/app/_components/workspace-user-menu";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { isStaffRole } from "@/shared/security/landing-path";
import { useAgentSummary } from "@/features/listings/queries/use-agent-workspace";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const overviewItem: NavigationItem = {
  label: "Overview",
  icon: LayoutDashboard,
  href: "/account",
};

function NavSection({
  label,
  items,
  pathname,
  badges,
  className,
}: {
  label: string;
  items: NavigationItem[];
  pathname: string;
  badges?: Record<string, number>;
  className?: string;
}) {
  return (
    <SidebarGroup className={className}>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
          {items.map((item) => {
            const Icon = item.icon;
            // `/account` is a prefix of every child route, so the overview tab
            // only counts as active on an exact match.
            const active =
              item.href === "/account"
                ? pathname === "/account"
                : isActivePath(pathname, item.href);
            const badge = badges?.[item.href];
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  isActive={active}
                  tooltip={item.label}
                  aria-current={active ? "page" : undefined}
                  render={<Link href={item.href} />}
                >
                  <Icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
                {badge ? <SidebarMenuBadge>{badge}</SidebarMenuBadge> : null}
              </SidebarMenuItem>
            );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

function AccountHeader({ title }: { title: string }) {
  const { state, isMobile } = useSidebar();
  // The sidebar keeps its own trigger until it collapses; two at once is noise.
  const showTrigger = isMobile || state === "collapsed";

  return (
    <header className="sticky top-0 z-40 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        {showTrigger ? (
          <>
            <SidebarTrigger className="-ml-1 flex" />
            <Separator
              orientation="vertical"
              className="mx-2 data-[orientation=vertical]:h-8"
            />
          </>
        ) : null}
        <span className="shrink-0 text-muted-foreground">Account</span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        <h1 className="truncate text-base font-medium">{title}</h1>
      </div>
      <NotificationBell />
    </header>
  );
}

export function AccountShell({
  bleed = false,
  children,
  title,
}: {
  /** Drops the page padding so a full-height screen owns the area under the header. */
  bleed?: boolean;
  children: ReactNode;
  title: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const agent = useAgentSummary();

  const staff = isStaffRole(session.data?.user.role);

  useEffect(() => {
    if (session.isPending) return;
    if (!session.data) {
      router.replace(`/sign-in?callbackURL=${encodeURIComponent(pathname)}`);
      return;
    }
    // Staff work out of the console; the customer account overview is not their
    // home. Deeper pages (profile, security) stay reachable.
    // Staff have no customer area: their settings, messages and everything
    // else live in the console, so the whole /account tree redirects there.
    if (staff) {
      router.replace(
        pathname.startsWith("/account/settings")
          ? "/dashboard/account"
          : "/dashboard",
      );
    }
  }, [pathname, router, session.data, session.isPending, staff]);

  if (staff) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Opening the admin console…
      </div>
    );
  }

  if (session.isPending || !session.data) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Checking your session…
      </div>
    );
  }

  const user = session.data.user;
  const isAgent = agent.data?.isAgent === true;
  const pendingOffers = agent.data?.isAgent ? agent.data.pendingOffers : 0;

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "17rem",
          "--header-height": "calc(var(--spacing) * 12 + 1px)",
        } as CSSProperties
      }
      className="min-h-dvh"
    >
      <Sidebar collapsible="icon">
        <SidebarHeader className="h-(--header-height) shrink-0 justify-center border-b">
          <SidebarMenu>
            <SidebarMenuItem className="flex flex-row items-center gap-2">
              <SidebarMenuButton
                className="data-[slot=sidebar-menu-button]:!p-1.5"
                tooltip="Bhumiraj Estates"
                render={<Link href="/" />}
              >
                <Image
                  src="/Logo.webp"
                  alt=""
                  width={32}
                  height={32}
                  className="size-8 shrink-0 rounded-lg object-cover"
                  priority
                />
                <span className="grid min-w-0 flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold text-[#07572f]">
                    BHUMIRAJ
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    Your account
                  </span>
                </span>
              </SidebarMenuButton>
              <SidebarTrigger className="-ml-1 flex group-data-[collapsible=icon]:hidden" />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <NavSection
            label="Account"
            items={[overviewItem, ...accountNavigation]}
            pathname={pathname}
          />
          {isAgent ? (
            <NavSection
              label="Agent workspace"
              items={agentNavigation}
              pathname={pathname}
              badges={{ "/account/offers": pendingOffers }}
            />
          ) : null}

          {/* Settings sits at the foot of the rail, as in the console. */}
          <NavSection
            label="System"
            items={accountSystemNavigation}
            pathname={pathname}
            className="mt-auto"
          />
        </SidebarContent>

        <SidebarFooter className="border-t">
          <WorkspaceUserMenu
            workspace="account"
            name={user.name || "Your account"}
            email={user.email}
            image={user.image}
          />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0 bg-muted/40 pb-24 min-[800px]:pb-0">
        <AccountHeader title={title} />

        <main
          id="main-content"
          className={bleed ? "min-w-0" : "min-w-0 p-4 sm:p-6 lg:p-8"}
        >
          {children}
        </main>
      </SidebarInset>

      <MarketplaceMobileNavigation />
    </SidebarProvider>
  );
}
