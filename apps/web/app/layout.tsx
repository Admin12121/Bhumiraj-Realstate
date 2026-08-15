import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ConnectivityStatus } from "@/app/_components/connectivity-status";
import { AppProviders } from "@/shared/providers/app-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Bhumiraj Estates", template: "%s · Bhumiraj Estates" },
  description: "Verified properties, trusted agents and live real-estate auctions in Nepal.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className="antialiased">
      <body className="bg-white">
        <a
          href="#main-content"
          className="sr-only fixed left-4 top-4 z-[100] rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white focus:not-sr-only"
        >
          Skip to main content
        </a>
        <AppProviders>
          <ConnectivityStatus />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
