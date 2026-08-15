"use client"

import Link from "next/link"
import { useEffect, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  BarChart3,
  Bell,
  Building2,
  FileCheck2,
  Gavel,
  History,
  LogOut,
  MessageSquare,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react"
import { signOut, useSession } from "@real-estate/auth/client"
import { getAdminAccess } from "@/features/admin/api/admin-api"
import { BrandLogo } from "@/shared/components/brand-logo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MobileBottomNavigation } from "@/app/_components/mobile-bottom-navigation"
import type { NavigationItem } from "@/app/_components/navigation-model"

const sections = [
  {
    label: "Overview",
    items: [
      {
        label: "Dashboard",
        icon: BarChart3,
        href: "/admin",
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
        href: "/admin/listings",
        permission: "admin.listings.read",
      },
      {
        label: "Auctions",
        icon: Gavel,
        href: "/admin/auctions",
        permission: "admin.auctions.read",
      },
      {
        label: "Moderation",
        icon: FileCheck2,
        href: "/admin/moderation",
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
        href: "/admin/users",
        permission: "admin.users.read",
      },
      {
        label: "Staff",
        icon: UserCog,
        href: "/admin/staff",
        permission: "admin.staff.read",
      },
      {
        label: "Staff roles",
        icon: ShieldCheck,
        href: "/admin/roles",
        permission: "admin.roles.read",
      },
      {
        label: "Agents",
        icon: ShieldCheck,
        href: "/admin/agents",
        permission: "admin.agents.read",
      },
      {
        label: "Messages",
        icon: MessageSquare,
        href: "/admin/messages",
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
        href: "/admin/audit",
        permission: "admin.audit.read",
      },
      {
        label: "Settings",
        icon: Settings,
        href: "/admin/settings",
        permission: "admin.settings.read",
      },
    ],
  },
] as const

function isActiveRoute(pathname: string, href: string): boolean {
  return href === "/admin"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`)
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
      <BrandLogo />
      <div className="mt-8 space-y-6">
        {sections.map((section) => {
          const available = section.items.filter((item) =>
            permissions.has(item.permission)
          )
          if (available.length === 0) return null
          return (
            <div key={section.label}>
              <p className="mb-2 px-3 text-[10px] font-bold tracking-[.16em] text-muted-foreground uppercase">
                {section.label}
              </p>
              <nav className="space-y-1" aria-label={section.label}>
                {available.map(({ label, icon: Icon, href }) => (
                  <Button
                    key={href}
                    variant="ghost"
                    className={`w-full justify-start border-0 ${isActiveRoute(pathname, href) ? "bg-emerald-50 text-emerald-900" : "text-slate-600"}`}
                    render={<Link href={href} />}
                  >
                    <Icon />
                    {label}
                  </Button>
                ))}
              </nav>
            </div>
          )
        })}
      </div>
    </>
  )
}

export function AdminShell({
  title,
  description,
  children,
}: {
  title: string
  description?: string
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
  const handleSignOut = () =>
    signOut({ fetchOptions: { onSuccess: () => location.assign("/") } })
  const nav = <AdminNavigation pathname={pathname} permissions={permissions} />
  const mobileItems: NavigationItem[] = sections.flatMap((section) =>
    section.items
      .filter((item) => permissions.has(item.permission))
      .map((item) => ({
        label: item.label,
        icon: item.icon,
        href: item.href,
      }))
  )

  return (
    <div className="min-h-screen bg-[#f7f9f7]">
      <aside className="fixed inset-y-0 left-0 hidden w-[258px] border-r bg-white p-5 lg:flex lg:flex-col">
        {nav}
        <Button
          variant="ghost"
          className="mt-auto w-full justify-start border-0 text-slate-600 hover:text-destructive"
          onClick={handleSignOut}
        >
          <LogOut />
          Sign out
        </Button>
      </aside>

      <div className="pb-24 min-[800px]:pb-0 lg:pl-[258px]">
        <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
          <div className="flex h-18 items-center gap-4 px-5 lg:px-8">
            <BrandLogo
              compact
              className="shrink-0 lg:hidden [&_img]:size-9 [&_img]:rounded-xl"
            />
            <div className="flex-1">
              <h1 className="text-lg font-semibold">{title}</h1>
              {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
              )}
            </div>
            {permissions.has("admin.messages.read") && (
              <Button
                size="icon"
                variant="ghost"
                render={
                  <Link
                    href="/admin/messages"
                    aria-label="Open admin messages"
                  />
                }
              >
                <Bell />
              </Button>
            )}
            <div className="flex items-center gap-3 border-l pl-4">
              <span className="flex size-9 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-800">
                {session.data.user.name?.[0] || "A"}
              </span>
              <span className="hidden sm:block">
                <span className="block text-sm font-semibold">
                  {session.data.user.name || "Administrator"}
                </span>
                <Badge
                  size="sm"
                  variant={
                    access.data.accountType === "OWNER"
                      ? "success"
                      : "secondary"
                  }
                >
                  {access.data.accountType}
                </Badge>
              </span>
            </div>
          </div>
        </header>
        <main id="main-content" className="p-5 lg:p-8">{children}</main>
      </div>
      <MobileBottomNavigation
        ariaLabel="Admin navigation"
        primaryItems={mobileItems.slice(0, 4)}
        overflowItems={mobileItems.slice(4)}
        onSignOut={handleSignOut}
      />
    </div>
  )
}
