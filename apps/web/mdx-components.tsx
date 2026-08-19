import type { ComponentProps } from "react";
import Link from "next/link";

type Components = Record<string, unknown>;

/**
 * Styling for MDX prose, kept here so the .mdx files stay pure content — the
 * legal wording can be edited without meeting a single className.
 */
export function useMDXComponents(components: Components): Components {
  return {
    h1: (props: ComponentProps<"h1">) => (
      <h1
        className="text-[32px] leading-[1.1] font-semibold tracking-[-.03em] text-[#202020] sm:text-[38px]"
        {...props}
      />
    ),
    h2: (props: ComponentProps<"h2">) => (
      <h2
        className="mt-10 text-[20px] leading-7 font-[550] tracking-[-.01em] text-[#202020]"
        {...props}
      />
    ),
    h3: (props: ComponentProps<"h3">) => (
      <h3
        className="mt-6 text-[17px] leading-6 font-[550] text-[#202020]"
        {...props}
      />
    ),
    p: (props: ComponentProps<"p">) => (
      <p className="mt-3 text-[16px] leading-7 text-[#3f3f3f]" {...props} />
    ),
    ul: (props: ComponentProps<"ul">) => (
      <ul
        className="mt-3 flex list-disc flex-col gap-2 pl-5 text-[16px] leading-7 text-[#3f3f3f]"
        {...props}
      />
    ),
    ol: (props: ComponentProps<"ol">) => (
      <ol
        className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-[16px] leading-7 text-[#3f3f3f]"
        {...props}
      />
    ),
    strong: (props: ComponentProps<"strong">) => (
      <strong className="font-[550] text-[#202020]" {...props} />
    ),
    hr: (props: ComponentProps<"hr">) => (
      <hr className="my-10 border-black/[.08]" {...props} />
    ),
    a: ({ href = "", children }: ComponentProps<"a">) => {
      const className =
        "underline underline-offset-4 hover:text-[#202020]";
      if (href.startsWith("/")) {
        return (
          <Link href={href} className={className}>
            {children}
          </Link>
        );
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className={className}
        >
          {children}
        </a>
      );
    },
    ...components,
  };
}
