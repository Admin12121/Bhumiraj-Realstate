import type { ReactNode } from "react";
import { PublicHeader, SiteFooter } from "@/app/_components";

/**
 * Chrome for the legal pages, so each .mdx file holds nothing but the wording.
 * Set NEXT_PUBLIC_LEGAL_UPDATED when the text actually changes.
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  const updated = process.env.NEXT_PUBLIC_LEGAL_UPDATED;

  return (
    <>
      <PublicHeader />
      <main
        id="main-content"
        className="mx-auto w-full max-w-[760px] px-6 pt-[112px] pb-24 lg:px-8"
      >
        {updated ? (
          <p className="mb-8 text-[13px] text-[#8a8a8a]">
            Last updated {updated}
          </p>
        ) : null}
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
