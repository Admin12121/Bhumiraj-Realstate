import type { MetadataRoute } from "next";

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost").replace(
    /\/$/,
    "",
  );
}

/**
 * Crawlers get the public marketplace and nothing behind a session. The account
 * and admin areas are disallowed rather than merely unlinked, so a leaked URL
 * does not end up indexed.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/account",
          "/admin",
          "/api/",
          "/sign-in",
          "/sign-up",
          "/two-factor",
          "/reset-password",
          "/forgot-password",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
