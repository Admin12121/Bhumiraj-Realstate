import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Geist_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import { AppProviders } from "@/shared/providers/app-providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "Bhumiraj Estates", template: "%s · Bhumiraj Estates" },
  description: "Verified properties, trusted agents and live real-estate auctions in Nepal.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en" suppressHydrationWarning className={cn("antialiased", inter.variable, mono.variable)}>
    <body><AppProviders>{children}</AppProviders></body>
  </html>;
}
