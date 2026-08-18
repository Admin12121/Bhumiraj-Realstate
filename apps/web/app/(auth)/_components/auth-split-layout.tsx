"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { BrandLogo } from "@/shared/components/brand-logo"
import { DissolvePanel, type DissolveSlide } from "./dissolve-panel"

/** Panel copy, so the imagery is not silent decoration. */
const SLIDES: DissolveSlide[] = [
  {
    image: "/images/featured-3.webp",
    title: "Start your property journey with confidence",
    body: "Verified listings, appointed agents and clear pricing across Nepal.",
  },
  {
    image: "/images/featured-1.webp",
    title: "Every property checked before it is published",
    body: "Ownership documents are confirmed against land-registry records.",
  },
  {
    image: "/images/featured-4.webp",
    title: "One agent, from viewing to transfer",
    body: "No hidden fees, and nothing to pay until a deal completes.",
  },
]

/**
 * Two-pane authentication shell: imagery on the left, the form on the right.
 * The panel is hidden below `lg`, where it would only push the form off-screen.
 */
export function AuthSplitLayout({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="relative hidden lg:block">
        <DissolvePanel slides={SLIDES} />
      </aside>

      <section className="flex min-h-screen flex-col px-5 py-8 sm:px-10">
        {/* The cross-link to the other form lives inside the form itself, so
            the header carries the brand alone. */}
        <header className="flex items-center">
          <BrandLogo />
        </header>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {description}
            </p>

            <div className="mt-7">{children}</div>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} Bhumiraj Estates</span>
          <span className="flex gap-4">
            <Link href="/legal/privacy" className="hover:text-slate-800">
              Privacy policy
            </Link>
            <Link href="/support" className="hover:text-slate-800">
              Support
            </Link>
          </span>
        </footer>
      </section>
    </main>
  )
}
