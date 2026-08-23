"use client"

import Link from "next/link"
import Image from "next/image"
import {
  createContext,
  useContext,
  useEffect,
  type CSSProperties,
  type ReactNode,
} from "react"
import { usePathname, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  BadgeDollarSign,
  ChevronRight,
  BarChart3,
  Building2,
  FileCheck2,
  Gavel,
  History,
  MessageSquare,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react"
import { signOut, useSession } from "@real-estate/auth/client"
import { getAdminAccess } from "@/features/admin/api/admin-api"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { MobileBottomNavigation } from "@/app/_components/mobile-bottom-navigation"
import { WorkspaceUserMenu } from "@/app/_components/workspace-user-menu"
import { NotificationBell } from "@/features/notifications/components/notification-bell"
import { StepUpProvider } from "./step-up-dialog"
import { TwoFactorNudge } from "./two-factor-nudge"
import type { NavigationItem } from "@/app/_components/navigation-model"

const sections = [
  {
    label: "Overview",
    items: [
      {
        label: "Dashboard",
        icon: BarChart3,
        href: "/dashboard",
        permission: "admin.overview.read",
      },
    ],
  },
  {
    label: "Marketplace",
    items: [
      {
        label: "Listings",
        icon: Building2,
        href: "/dashboard/listings",
        permission: "admin.listings.read",
      },
      {
        label: "Payments",
        icon: BadgeDollarSign,
        href: "/dashboard/payments",
        permission: "admin.payments.read",
      },
      {
        label: "Auctions",
        icon: Gavel,
        href: "/dashboard/auctions",
        permission: "admin.auctions.read",
      },
      {
        label: "Support",
        icon: MessageSquare,
        href: "/dashboard/support",
        permission: "admin.support.read",
      },
      {
        label: "Moderation",
        icon: FileCheck2,
        href: "/dashboard/moderation",
        permission: "admin.moderation.read",
      },
    ],
  },
  {
    label: "People",
    items: [
      {
        label: "Users",
        icon: Users,
        href: "/dashboard/users",
        permission: "admin.users.read",
      },
      {
        label: "Staff",
        icon: UserCog,
        href: "/dashboard/staff",
        permission: "admin.staff.read",
      },
      {
        label: "Staff roles",
        icon: ShieldCheck,
        href: "/dashboard/roles",
        permission: "admin.roles.read",
      },
      {
        label: "Agents",
        icon: ShieldCheck,
        href: "/dashboard/agents",
        permission: "admin.agents.read",
      },
      {
        label: "Messages",
        icon: MessageSquare,
        href: "/dashboard/messages",
        permission: "admin.messages.read",
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        label: "Audit log",
        icon: History,
        href: "/dashboard/audit",
        permission: "admin.audit.read",
      },
      {
        label: "Settings",
        icon: Settings,
        href: "/dashboard/settings",
        permission: "admin.settings.read",
      },
    ],
  },
] as const

function isActiveRoute(pathname: string, href: string): boolean {
  return href === "/dashboard"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`)
}

const StaffPermissionsContext = createContext<ReadonlySet<string>>(new Set())

/** Permission keys granted to the signed-in staff member. */
export function useStaffPermissions(): ReadonlySet<string> {
  return useContext(StaffPermissionsContext)
}

export function useHasStaffPermission(permission: string): boolean {
  return useStaffPermissions().has(permission)
}

/** Renders children only when the staff member holds every listed permission. */
export function RequireStaffPermission({
  permission,
  fallback = null,
  children,
}: {
  permission: string | string[]
  fallback?: ReactNode
  children: ReactNode
}) {
  const permissions = useStaffPermissions()
  const required = Array.isArray(permission) ? permission : [permission]
  if (!required.every((key) => permissions.has(key))) return <>{fallback}</>
  return <>{children}</>
}

function AdminNavigation({
  pathname,
  permissions,
}: {
  pathname: string
  permissions: Set<string>
}) {
  return (
    <>
      {sections.map((section) => {
        const available = section.items.filter((item) =>
          permissions.has(item.permission)
        )
        if (available.length === 0) return null
        return (
          <SidebarGroup
            key={section.label}
            // System sits at the foot of the rail: it is where you go
            // occasionally, not what you work in all day.
            className={section.label === "System" ? "mt-auto" : undefined}
          >
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {available.map(({ label, icon: Icon, href }) => {
                  const active = isActiveRoute(pathname, href)
                  return (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={label}
                        aria-current={active ? "page" : undefined}
                        render={<Link href={href} />}
                      >
                        <Icon />
                        <span>{label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )
      })}
    </>
  )
}

function AdminHeader({
  title,
  accountType,
}: {
  title: string
  accountType: string
}) {
  const { state, isMobile } = useSidebar()
  // Only offer a trigger here once the sidebar's own has collapsed away.
  const showTrigger = isMobile || state === "collapsed"

  return (
    <header className="sticky top-0 z-40 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-6">
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
        <span className="shrink-0 text-muted-foreground">Admin</span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        <h1 className="truncate text-base font-medium">{title}</h1>
      </div>
      <NotificationBell />
      <Badge size="sm" variant={accountType === "OWNER" ? "success" : "secondary"}>
        {accountType}
      </Badge>
    </header>
  )
}

export function AdminShell({
  title,
  permission,
  bleed = false,
  children,
}: {
  title: string
  /** Permission required to view this page; omit for pages open to any staff. */
  permission?: string
  /**
   * Drops the page padding so a full-height editor can own the area under the
   * header, the way the roles editor does.
   */
  bleed?: boolean
  children: ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const session = useSession()
  const access = useQuery({
    queryKey: ["admin", "access"],
    queryFn: getAdminAccess,
    enabled: Boolean(session.data),
    retry: false,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (session.isPending) return
    if (!session.data) {
      router.replace(`/sign-in?callbackURL=${encodeURIComponent(pathname)}`)
      return
    }
    if (access.isError) router.replace("/")
  }, [access.isError, pathname, router, session.data, session.isPending])

  if (session.isPending || access.isPending || !session.data || !access.data) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Checking administrator access…
      </div>
    )
  }

  const permissions = new Set(access.data.permissions)
  // The page still renders inside the shell so a staff member who lands on a
  // page they cannot see keeps the navigation they can.
  const denied = Boolean(permission && !permissions.has(permission))
  const mobileItems: NavigationItem[] = sections.flatMap((section) =>
    section.items
      .filter((item) => permissions.has(item.permission))
      .map((item) => ({
        label: item.label,
        icon: item.icon,
        href: item.href,
      }))
  )
  const user = session.data.user

  return (
    <StaffPermissionsContext.Provider value={permissions}>
      <StepUpProvider>
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
                    tooltip="Admin console"
                    render={<Link href="/dashboard" />}
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
                        Admin console
                      </span>
                    </span>
                  </SidebarMenuButton>
                  <SidebarTrigger className="-ml-1 flex group-data-[collapsible=icon]:hidden" />
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
              <AdminNavigation pathname={pathname} permissions={permissions} />
            </SidebarContent>

            <SidebarFooter className="border-t">
              <WorkspaceUserMenu
                workspace="admin"
                name={user.name || "Administrator"}
                email={user.email}
                image={user.image}
                badge={access.data.accountType}
              />
            </SidebarFooter>
            <SidebarRail />
          </Sidebar>

          <SidebarInset className="min-w-0 bg-[#f7f9f7] pb-24 min-[800px]:pb-0">
            <AdminHeader
              title={denied ? "Access restricted" : title}
              accountType={access.data.accountType}
            />

            <main
              id="main-content"
              className={bleed ? "min-w-0" : "min-w-0 p-4 sm:p-6 lg:p-8"}
            >
              {bleed ? null : <TwoFactorNudge />}
              {denied ? (
                <div className="mx-auto max-w-md space-y-3 py-16 text-center">
                  <h2 className="text-lg font-semibold">
                    You do not have access to this page
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Your staff roles do not include the permission this page
                    requires. Ask an administrator if you need it.
                  </p>
                </div>
              ) : (
                children
              )}
            </main>
          </SidebarInset>

          <MobileBottomNavigation
            ariaLabel="Admin navigation"
            primaryItems={mobileItems.slice(0, 4)}
            overflowItems={mobileItems.slice(4)}
            onSignOut={() =>
              signOut({ fetchOptions: { onSuccess: () => location.assign("/") } })
            }
          />
        </SidebarProvider>
      </StepUpProvider>
    </StaffPermissionsContext.Provider>
  )
}
