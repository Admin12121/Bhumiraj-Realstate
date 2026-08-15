import type { ComponentType } from "react";
import {
  Bell,
  Bookmark,
  Gavel,
  Home,
  HousePlus,
  KeyRound,
  LogIn,
  MessageCircle,
  Search,
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
  { label: "Explore", icon: Search, href: "/properties" },
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
  { label: "Explore", icon: Search, href: "/properties" },
];

export const accountNavigation: NavigationItem[] = [
  { label: "Profile", icon: UserRound, href: "/account/profile" },
  { label: "Security", icon: ShieldCheck, href: "/account/security" },
  { label: "Sessions", icon: KeyRound, href: "/account/sessions" },
  { label: "Saved", icon: Bookmark, href: "/account/saved" },
  { label: "My bids", icon: Gavel, href: "/account/bids" },
  { label: "Messages", icon: MessageCircle, href: "/account/messages" },
  { label: "Alerts", icon: Bell, href: "/account/alerts" },
];

export const authenticatedMobilePrimaryNavigation: NavigationItem[] = [
  { label: "Home", icon: Home, href: "/" },
  { label: "Explore", icon: Search, href: "/properties" },
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
  { label: "My bids", icon: Gavel, href: "/account/bids" },
  { label: "Profile", icon: UserRound, href: "/account/profile" },
  { label: "Security", icon: ShieldCheck, href: "/account/security" },
  { label: "Sessions", icon: KeyRound, href: "/account/sessions" },
];

export const guestMobilePrimaryNavigation: NavigationItem[] = [
  { label: "Home", icon: Home, href: "/" },
  { label: "Explore", icon: Search, href: "/properties" },
  {
    label: "Post",
    icon: HousePlus,
    href: "/post-property",
    prominent: true,
  },
  { label: "Agents", icon: UsersRound, href: "/agents" },
];

export const guestMobileMoreNavigation: NavigationItem[] = [
  { label: "Live auctions", icon: Gavel, href: "/properties?type=AUCTION" },
  { label: "Sign in", icon: LogIn, href: "/sign-in" },
];

export function isActivePath(pathname: string, href: string) {
  const route = href.split("?")[0] || href;
  if (route === "/") return pathname === "/";
  return pathname === route || pathname.startsWith(`${route}/`);
}
