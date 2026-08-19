import type { ReactNode } from "react";

/**
 * Shared frame for the static content pages. Keeps them on the same measure
 * and rhythm as the rest of the marketplace instead of each inventing its own.
 */
export function PageShell({
  title,
  lead,
  updated,
  children,
}: {
  title: string;
  lead?: string;
  /** Shown on legal pages, where the revision date is part of the content. */
  updated?: string | undefined;
  children: ReactNode;
}) {
  return (
    <main
      id="main-content"
      className="mx-auto w-full max-w-[760px] px-6 pt-[112px] pb-24 lg:px-8"
    >
      <header className="border-b pb-8">
        <h1 className="text-[32px] leading-[1.1] font-semibold tracking-[-.03em] text-[#202020] sm:text-[38px]">
          {title}
        </h1>
        {lead ? (
          <p className="mt-3 text-[17px] leading-7 text-[#636363]">{lead}</p>
        ) : null}
        {updated ? (
          <p className="mt-4 text-[13px] text-[#8a8a8a]">
            Last updated {updated}
          </p>
        ) : null}
      </header>

      <div className="prose-bhumiraj mt-8 flex flex-col gap-6">{children}</div>
    </main>
  );
}

export function Section({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[20px] leading-7 font-[550] tracking-[-.01em] text-[#202020]">
        {heading}
      </h2>
      <div className="flex flex-col gap-3 text-[16px] leading-7 text-[#3f3f3f]">
        {children}
      </div>
    </section>
  );
}
