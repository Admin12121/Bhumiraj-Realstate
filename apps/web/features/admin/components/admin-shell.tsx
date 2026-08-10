"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  Building2,
  FileCheck2,
  Gavel,
  History,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { signOut, useSession } from "@real-estate/auth/client";
import { BrandLogo } from "@/shared/components/brand-logo";

const administrativeRoles = new Set(["MODERATOR", "ADMIN", "SUPER_ADMIN"]);
const sections = [
  {
    label: "Overview",
    items: [["Dashboard", BarChart3, "/admin"]],
  },
  {
    label: "Marketplace",
    items: [
      ["Listings", Building2, "/admin/listings"],
      ["Auctions", Gavel, "/admin/auctions"],
      ["Moderation", FileCheck2, "/admin/moderation"],
    ],
  },
  {
    label: "People",
    items: [
      ["Users", Users, "/admin/users"],
      ["Agents", ShieldCheck, "/admin/agents"],
      ["Messages", MessageSquare, "/admin/messages"],
    ],
  },
  {
    label: "System",
    items: [
      ["Audit log", History, "/admin/audit"],
      ["Settings", Settings, "/admin/settings"],
    ],
  },
] as const;

function isActiveRoute(pathname: string, href: string): boolean {
  return href === "/admin"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

function AdminNavigation({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <BrandLogo />
      <div className="mt-8 space-y-6">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="mb-2 px-3 text-[10px] font-bold tracking-[.16em] text-slate-400 uppercase">
              {section.label}
            </p>
            <nav className="space-y-1" aria-label={section.label}>
              {section.items.map(([label, Icon, href]) => (
	                <Link
	                  key={href}
	                  href={href}
	                  {...(onNavigate === undefined ? {} : { onClick: onNavigate })}
	                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                    isActiveRoute(pathname, href)
                      ? "bg-emerald-50 text-emerald-900"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="size-4.5" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        ))}
      </div>
    </>
  );
}

export function AdminShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = (session.data?.user as { role?: string } | undefined)?.role;
  const authorized = administrativeRoles.has(role ?? "");

  useEffect(() => {
    if (session.isPending) return;
    if (!session.data) {
      router.replace(
        `/sign-in?callbackURL=${encodeURIComponent(pathname)}`,
      );
      return;
    }
    if (!authorized) router.replace("/");
  }, [authorized, pathname, router, session.data, session.isPending]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (session.isPending || !session.data || !authorized) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-slate-500">
        Checking administrator access…
      </div>
    );
  }

  const handleSignOut = () =>
    signOut({ fetchOptions: { onSuccess: () => location.assign("/") } });

  return (
    <div className="min-h-screen bg-[#f7f9f7]">
      <aside className="fixed inset-y-0 left-0 hidden w-[258px] border-r bg-white p-5 lg:flex lg:flex-col">
        <AdminNavigation pathname={pathname} />
        <div className="mt-auto border-t pt-4">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close admin navigation"
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-[290px] max-w-[88vw] flex-col bg-white p-5 shadow-2xl">
            <button
              type="button"
              aria-label="Close admin navigation"
              className="absolute top-4 right-4 rounded-lg border p-2"
              onClick={() => setMobileOpen(false)}
            >
              <X className="size-4" />
            </button>
            <AdminNavigation
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-auto flex items-center gap-3 rounded-xl border-t px-3 py-3 text-sm text-slate-600"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </aside>
        </div>
      )}

      <div className="lg:pl-[258px]">
        <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
          <div className="flex h-18 items-center gap-4 px-5 lg:px-8">
            <button
              type="button"
              aria-label="Open admin navigation"
              className="rounded-lg border p-2 lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-semibold">{title}</h1>
              {description && (
                <p className="text-xs text-slate-500">{description}</p>
              )}
            </div>
            <Link
              href="/admin/messages"
              aria-label="Open admin messages"
              className="rounded-full p-2 hover:bg-slate-50"
            >
              <Bell className="size-5" />
            </Link>
            <div className="flex items-center gap-3 border-l pl-4">
              <span className="flex size-9 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-800">
                {session.data.user.name?.[0] || "A"}
              </span>
              <span className="hidden sm:block">
                <span className="block text-sm font-semibold">
                  {session.data.user.name || "Administrator"}
                </span>
                <span className="block text-[10px] text-slate-500 uppercase">
                  {role || "Admin"}
                </span>
              </span>
            </div>
          </div>
        </header>
        <main className="p-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
