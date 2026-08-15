"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { signOut, useSession } from "@real-estate/auth/client";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerMenu,
  DrawerMenuItem,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import {
  authenticatedMobileMoreNavigation,
  authenticatedMobilePrimaryNavigation,
  guestMobileMoreNavigation,
  guestMobilePrimaryNavigation,
  isActivePath,
  type NavigationItem,
} from "./navigation-model";

export function MobileBottomNavigation({
  ariaLabel,
  primaryItems,
  overflowItems,
  onSignOut,
}: {
  ariaLabel: string;
  primaryItems: NavigationItem[];
  overflowItems: NavigationItem[];
  onSignOut?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={ariaLabel}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-md min-[800px]:hidden"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-stretch">
        {primaryItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);

          return (
            <Button
              key={item.href}
              aria-current={active ? "page" : undefined}
              variant="ghost"
              className={cn(
                "relative h-full min-h-12 flex-col gap-1 rounded-xl border-0 px-1 text-[10px] font-semibold text-slate-500",
                active && "bg-emerald-50 text-emerald-800",
                item.prominent &&
                  "mx-auto -mt-3 size-14 self-start rounded-2xl bg-emerald-800 text-white shadow-lg hover:bg-emerald-700 hover:text-white",
              )}
              render={<Link href={item.href} />}
            >
              <Icon className="size-5" />
              <span>{item.label}</span>
            </Button>
          );
        })}

        <Drawer>
          <DrawerTrigger
            render={
              <Button
                variant="ghost"
                className="h-full min-h-12 flex-col gap-1 rounded-xl border-0 px-1 text-[10px] font-semibold text-slate-500"
              />
            }
          >
            <Menu className="size-5" />
            <span>More</span>
          </DrawerTrigger>
          <DrawerPopup showBar>
            <DrawerHeader>
              <DrawerTitle>More options</DrawerTitle>
              <DrawerDescription>
                Open the rest of the sections available to you.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerPanel className="pb-8">
              <DrawerMenu aria-label={`${ariaLabel} more options`}>
                {overflowItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActivePath(pathname, item.href);
                  return (
                    <DrawerMenuItem
                      key={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "min-h-12 rounded-xl px-3",
                        active && "bg-emerald-50 text-emerald-900",
                      )}
                      render={<Link href={item.href} />}
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </DrawerMenuItem>
                  );
                })}
                {onSignOut ? (
                  <DrawerMenuItem
                    className="mt-2 min-h-12 rounded-xl border-t px-3 text-red-600"
                    onClick={onSignOut}
                    variant="destructive"
                  >
                    <LogOut />
                    <span>Sign out</span>
                  </DrawerMenuItem>
                ) : null}
              </DrawerMenu>
            </DrawerPanel>
          </DrawerPopup>
        </Drawer>
      </div>
    </nav>
  );
}

export function MarketplaceMobileNavigation() {
  const session = useSession();
  const authenticated = Boolean(session.data?.user);

  return (
    <MobileBottomNavigation
      ariaLabel="Marketplace navigation"
      primaryItems={
        authenticated
          ? authenticatedMobilePrimaryNavigation
          : guestMobilePrimaryNavigation
      }
      overflowItems={
        authenticated
          ? authenticatedMobileMoreNavigation
          : guestMobileMoreNavigation
      }
      {...(authenticated
        ? {
            onSignOut: () => {
              void signOut({
                fetchOptions: { onSuccess: () => location.assign("/") },
              });
            },
          }
        : {})}
    />
  );
}
