"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import { signOut, useSession } from "@real-estate/auth/client";

import { MarketplaceMobileNavigation } from "@/app/_components/mobile-bottom-navigation";
import {
  accountNavigation,
  agentNavigation,
  isActivePath,
} from "@/app/_components/navigation-model";
import { useAgentSummary } from "@/features/listings/queries/use-agent-workspace";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/shared/components/brand-logo";

export function AccountShell({
  children,
  title,
  description,
}: {
  children: ReactNode;
  title: string;
  description: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const agent = useAgentSummary();

  useEffect(() => {
    if (!session.isPending && !session.data) {
      router.replace(`/sign-in?callbackURL=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router, session.data, session.isPending]);

  if (session.isPending || !session.data) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-slate-500">
        Checking your session…
      </div>
    );
  }

  // Agents get one extra section; everyone else sees the plain account nav.
  const navigation = agent.data?.isAgent
    ? [...accountNavigation, ...agentNavigation]
    : accountNavigation;
  const pendingOffers = agent.data?.isAgent ? agent.data.pendingOffers : 0;

  const handleSignOut = () =>
    signOut({ fetchOptions: { onSuccess: () => location.assign("/") } });

  return (
    <div className="min-h-dvh bg-slate-50 pb-24 min-[800px]:pb-0">
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-5">
          <BrandLogo
            compact
            className="[&_img]:size-9 [&_img]:rounded-xl sm:[&_img]:size-11"
          />
          <Button
            variant="ghost"
            className="border-0 text-slate-600"
            render={<Link href="/" />}
          >
            <ArrowLeft />
            <span className="hidden sm:inline">Back to marketplace</span>
            <span className="sm:hidden">Marketplace</span>
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-7 px-4 py-6 sm:px-5 lg:grid-cols-[240px_minmax(0,1fr)] lg:py-8">
        <aside className="surface hidden h-fit rounded-2xl p-3 lg:block">
          <nav className="space-y-1" aria-label="Account settings">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(pathname, item.href);
              return (
                <Button
                  key={item.href}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start border-0 text-slate-600",
                    active && "bg-emerald-50 text-emerald-900",
                  )}
                  aria-current={active ? "page" : undefined}
                  render={<Link href={item.href} />}
                >
                  <Icon />
                  {item.label}
                  {item.href === "/account/offers" && pendingOffers > 0 ? (
                    <span className="ml-auto grid size-5 place-items-center rounded-full bg-emerald-700 text-[11px] font-semibold text-white">
                      {pendingOffers}
                    </span>
                  ) : null}
                </Button>
              );
            })}
          </nav>
          <Button
            variant="ghost"
            className="mt-3 w-full justify-start border-0 border-t text-red-600"
            onClick={handleSignOut}
          >
            <LogOut />
            Sign out
          </Button>
        </aside>

        <main id="main-content" className="min-w-0">
          <div className="mb-6">
            <p className="text-xs font-semibold tracking-[0.14em] text-emerald-800 uppercase lg:hidden">
              Your account
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              {description}
            </p>
          </div>
          {children}
        </main>
      </div>
      <MarketplaceMobileNavigation />
    </div>
  );
}
