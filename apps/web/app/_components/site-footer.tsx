"use client"

import Image from "next/image"
import Link from "next/link"

/**
 * Configured per deployment. A profile with no handle set is dropped rather
 * than rendered as a link that goes nowhere.
 */
const SOCIAL_LINKS = (
  [
    { label: "X (Twitter)", href: process.env.NEXT_PUBLIC_SOCIAL_X },
    { label: "Instagram", href: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM },
    { label: "TikTok", href: process.env.NEXT_PUBLIC_SOCIAL_TIKTOK },
    { label: "LinkedIn", href: process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN },
    { label: "YouTube", href: process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE },
  ] as const
).flatMap((entry) => (entry.href ? [{ ...entry, href: entry.href }] : []))

/**
 * Only destinations that exist. Marketing pages (about, blog, careers, legal)
 * have no route yet, and a footer full of `href="#"` is worse than a short one.
 */
const columns = [
  {
    title: "Browse",
    links: [
      { label: "Properties for sale", href: "/search?type=SALE" },
      { label: "Properties to rent", href: "/search?type=RENT" },
      { label: "Live auctions", href: "/search?type=AUCTION" },
    ],
  },
  {
    title: "Agents",
    links: [
      { label: "Find an agent", href: "/agents" },
      { label: "List your property", href: "/post-property" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Contact", href: "/contact" },
      { label: "Support", href: "/support" },
    ],
  },
] as const

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 font-semibold tracking-[-0.04em] text-black">
      <Image
        src="/Logo.webp"
        alt=""
        width={32}
        height={32}
        className="size-8 rounded-lg object-contain"
      />
      {!compact && <span className="text-[20px] leading-none">BHUMIRAJ</span>}
    </div>
  )
}


export function SiteFooter() {
  return (
    <>
      <footer className="relative w-full bg-[#f7f7f7] text-[14px] leading-5 text-black">
        <div
          className={
            SOCIAL_LINKS.length === 0
              ? "hidden"
              : "border-t border-black/[.05] py-8"
          }
        >
          <div className="mx-auto flex max-w-site flex-wrap items-center gap-x-8 gap-y-3 px-6 lg:px-8 2xl:px-12">
            <p className="w-full font-[550] text-[#202020] md:w-auto">
              Follow us @bhumiraj
            </p>
            {SOCIAL_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[#636363] underline-offset-4 hover:underline"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div className="border-t border-black/[.05] py-12">
          <div className="mx-auto grid min-h-[240px] max-w-site grid-cols-2 gap-x-4 gap-y-6 px-6 md:grid-cols-6 lg:grid-cols-12 lg:px-8 2xl:px-12">
            <div className="col-span-full mb-6 flex items-start lg:col-span-4 lg:mb-0">
              <Link href="/">
                <BrandMark />
              </Link>
            </div>
            {columns.map((column) => (
              <div
                key={column.title}
                className="col-span-1 md:col-span-3 lg:col-span-2"
              >
                <h3 className="pb-2.5 font-[550] text-[#202020]">
                  {column.title}
                </h3>
                <ul>
                  {column.links.map((link) => (
                    <li key={link.href} className="py-1.5">
                      <Link
                        href={link.href}
                        className="inline-flex items-center gap-2 text-[#636363] hover:text-[#202020] hover:underline hover:underline-offset-4"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-black/[.05]">
          <div className="mx-auto flex max-w-site flex-wrap items-center gap-x-6 gap-y-3 px-6 py-8 text-[#636363] lg:px-8 2xl:px-12">
            <span>© {new Date().getFullYear()} Bhumiraj Estates.</span>
          </div>
        </div>
      </footer>

    </>
  )
}

export { BrandMark }
