import type { ComponentType } from "react";
import {
  Bell,
  CalendarDays,
  Bookmark,
  Gavel,
  Handshake,
  Home,
  HousePlus,
  KeyRound,
  LogIn,
  MessageCircle,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";

export type NavigationIcon = ComponentType<{ className?: string }>;

export type NavigationItem = {
  href: string;
  icon: NavigationIcon;
  label: string;
  prominent?: boolean;
};

export const authenticatedMarketplaceNavigation: NavigationItem[] = [
  { label: "Home", icon: Home, href: "/" },
  { label: "Explore", icon: Search, href: "/search?type=SALE" },
  { label: "Saved", icon: Bookmark, href: "/account/saved" },
  { label: "Messages", icon: MessageCircle, href: "/account/messages" },
  { label: "Alerts", icon: Bell, href: "/account/alerts" },
  {
    label: "Post Property",
    icon: HousePlus,
    href: "/post-property",
    prominent: true,
  },
];

export const guestMarketplaceNavigation: NavigationItem[] = [
  { label: "Home", icon: Home, href: "/" },
  { label: "Explore", icon: Search, href: "/search?type=SALE" },
];

// Alerts is reached from the bell in the header, so it is not repeated here.
export const accountNavigation: NavigationItem[] = [
  { label: "Post property", icon: HousePlus, href: "/post-property" },
  { label: "Saved", icon: Bookmark, href: "/account/saved" },
  { label: "Auctions", icon: Gavel, href: "/account/auctions" },
  { label: "Messages", icon: MessageCircle, href: "/account/messages" },
  { label: "Notifications", icon: Bell, href: "/account/notifications" },
];

/**
 * Profile, security and sessions are one screen with three tabs, exactly as in
 * the admin console — same component, same route shape.
 */
export const accountSystemNavigation: NavigationItem[] = [
  { label: "Settings", icon: Settings, href: "/account/settings" },
];

/** Appended to the account nav only when the signed-in user is an agent. */
export const agentNavigation: NavigationItem[] = [
  { label: "Property offers", icon: Handshake, href: "/account/offers" },
  { label: "Viewings", icon: CalendarDays, href: "/account/viewings" },
];

export const authenticatedMobilePrimaryNavigation: NavigationItem[] = [
  { label: "Home", icon: Home, href: "/" },
  { label: "Explore", icon: Search, href: "/search?type=SALE" },
  {
    label: "Post",
    icon: HousePlus,
    href: "/post-property",
    prominent: true,
  },
  { label: "Saved", icon: Bookmark, href: "/account/saved" },
];

export const authenticatedMobileMoreNavigation: NavigationItem[] = [
  { label: "Messages", icon: MessageCircle, href: "/account/messages" },
  { label: "Alerts", icon: Bell, href: "/account/alerts" },
  { label: "Auctions", icon: Gavel, href: "/account/auctions" },
  { label: "Profile", icon: UserRound, href: "/account/profile" },
  { label: "Security", icon: ShieldCheck, href: "/account/security" },
  { label: "Sessions", icon: KeyRound, href: "/account/sessions" },
];

export const guestMobilePrimaryNavigation: NavigationItem[] = [
  { label: "Home", icon: Home, href: "/" },
  { label: "Explore", icon: Search, href: "/search?type=SALE" },
  {
    label: "Post",
    icon: HousePlus,
    href: "/post-property",
    prominent: true,
  },
  { label: "Agents", icon: UsersRound, href: "/agents" },
];

export const guestMobileMoreNavigation: NavigationItem[] = [
  { label: "Live auctions", icon: Gavel, href: "/search?type=AUCTION" },
  { label: "Sign in", icon: LogIn, href: "/sign-in" },
];

export function isActivePath(pathname: string, href: string) {
  const route = href.split("?")[0] || href;
  if (route === "/") return pathname === "/";
  return pathname === route || pathname.startsWith(`${route}/`);
}
