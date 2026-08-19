"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { HousePlus, LogIn, LogOut, Menu, UserRoundPlus } from "lucide-react"
import { signOut, useSession } from "@real-estate/auth/client"
import { Button } from "@/components/ui/button"
import { AccountMenu } from "./account-menu"
import {
  Drawer,
  DrawerHeader,
  DrawerMenu,
  DrawerMenuItem,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  accountNavigation,
  authenticatedMarketplaceNavigation,
  guestMarketplaceNavigation,
} from "./navigation-model"
import { cn } from "@/lib/utils"

/**
 * The reference's public header, unchanged in structure: brand on the left,
 * a single text action on the right. Transparent over the home hero until
 * scrolled, solid everywhere else.
 */
export function PublicHeader() {
  const pathname = usePathname()
  const session = useSession()
  const homePage = pathname === "/"
  const searchPage = pathname.startsWith("/search")
  const propertyPage = pathname.startsWith("/properties/")
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    // The property header is absolute on desktop and scrolls away, handing over
    // to the sticky section bar, so it never needs the scrolled treatment.
    if (propertyPage) return

    const onScroll = () => setScrolled(window.scrollY > 28)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [propertyPage])

  const isScrolled = propertyPage ? false : scrolled
  const solid =
    searchPage || (!homePage && !propertyPage) || (homePage && isScrolled)
  // The divider is a scroll affordance everywhere, not page chrome: a solid bar
  // sits flush until content passes beneath it.
  const showDivider = isScrolled
  const inverse = homePage && !solid
  const authenticated = Boolean(session.data)
  const sessionPending = session.isPending
  const userName: string | null = session.data?.user?.name ?? null

  // Signed-in users get the marketplace plus their account sections; guests get
  // the public destinations and a prominent post-property entry point.
  const menuItems = authenticated
    ? [...authenticatedMarketplaceNavigation, ...accountNavigation].filter(
        (item, index, all) =>
          all.findIndex((other) => other.href === item.href) === index,
      )
    : [
        ...guestMarketplaceNavigation,
        {
          label: "Post property",
          icon: HousePlus,
          href: "/post-property",
          prominent: true,
        },
      ]

  return (
    <header
      className={cn(
        "inset-x-0 top-0 z-50 h-[72px] border-b transition-[background-color,border-color,box-shadow] duration-200",
        propertyPage ? "fixed lg:absolute" : "fixed",
        solid
          ? cn(
              "bg-white/95 text-[#202020] backdrop-blur-xl",
              showDivider
                ? "border-black/[.08] shadow-[0_1px_0_rgba(0,0,0,.02)]"
                : "border-transparent shadow-none",
            )
          : propertyPage
            ? "border-transparent bg-transparent text-[#202020]"
            : "border-transparent bg-transparent text-white",
      )}
    >
      <div className="mx-auto flex h-full max-w-site items-center justify-between gap-5 px-6 lg:px-8 2xl:px-12">
        <div className="flex min-w-0 items-center">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <Image
              src="/Logo.webp"
              alt=""
              width={40}
              height={40}
              className="size-10 rounded-lg object-contain"
            />
            <span
              className={cn(
                "text-[20px] leading-none font-semibold tracking-[-0.04em]",
                inverse ? "text-white" : "text-black",
              )}
            >
              BHUMIRAJ ESTATES
            </span>
          </Link>
        </div>

        {/* Desktop keeps the reference's inline actions. */}
        <div className="hidden shrink-0 items-center gap-1 lg:flex">
          <Button size="sm" render={<Link href="/post-property">Post property</Link>} />
          {sessionPending ? (
            // Holding the slot while the session resolves; rendering "Log in"
            // first made an already-signed-in user watch the header change
            // under them a moment later.
            <span
              aria-hidden="true"
              className={cn(
                "size-10 shrink-0 animate-pulse rounded-full",
                inverse ? "bg-white/20" : "bg-black/[.06]",
              )}
            />
          ) : authenticated ? (
            <AccountMenu inverse={inverse} />
          ) : (
            <Link
              href="/sign-in"
              className={cn(
                "h-10 rounded-full px-4 text-[14px] leading-10 font-medium transition-colors",
                inverse
                  ? "text-white hover:bg-white/10"
                  : "text-[#202020] hover:bg-black/[.05]",
              )}
            >
              Log in
            </Link>
          )}
        </div>

        {/* Below desktop the actions collapse into one menu so the brand fits. */}
        <Drawer>
          <DrawerTrigger
            render={
              <button
                type="button"
                aria-label="Open menu"
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-full transition-colors lg:hidden",
                  inverse
                    ? "text-white hover:bg-white/10"
                    : "text-[#202020] hover:bg-black/[.05]",
                )}
              />
            }
          >
            <Menu className="size-6" strokeWidth={1.8} />
          </DrawerTrigger>

          <DrawerPopup showBar>
            <DrawerHeader>
              <DrawerTitle>
                {authenticated ? userName || "My account" : "Menu"}
              </DrawerTitle>
            </DrawerHeader>
            <DrawerPanel className="pb-8">
              <DrawerMenu aria-label="Site menu">
                {menuItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <DrawerMenuItem
                      key={item.href}
                      className={cn(
                        "min-h-12 rounded-xl px-3",
                        item.prominent &&
                          "bg-emerald-50 font-semibold text-emerald-900",
                      )}
                      render={<Link href={item.href} />}
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </DrawerMenuItem>
                  )
                })}

                {authenticated ? (
                  <DrawerMenuItem
                    className="mt-2 min-h-12 rounded-xl border-t px-3 text-red-600"
                    onClick={() =>
                      signOut({
                        fetchOptions: {
                          onSuccess: () => location.assign("/"),
                        },
                      })
                    }
                    variant="destructive"
                  >
                    <LogOut />
                    <span>Sign out</span>
                  </DrawerMenuItem>
                ) : (
                  <>
                    <DrawerMenuItem
                      className="mt-2 min-h-12 rounded-xl border-t px-3"
                      render={<Link href="/sign-in" />}
                    >
                      <LogIn />
                      <span>Log in</span>
                    </DrawerMenuItem>
                    <DrawerMenuItem
                      className="min-h-12 rounded-xl px-3"
                      render={<Link href="/sign-up" />}
                    >
                      <UserRoundPlus />
                      <span>Create account</span>
                    </DrawerMenuItem>
                  </>
                )}
              </DrawerMenu>
            </DrawerPanel>
          </DrawerPopup>
        </Drawer>
      </div>
    </header>
  )
}
