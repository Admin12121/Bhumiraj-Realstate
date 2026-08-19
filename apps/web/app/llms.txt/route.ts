import { publishedListings, siteUrl } from "@/shared/seo/public-catalogue";

export const revalidate = 900;

/**
 * The llms.txt convention: one page telling an assistant what this site is and
 * where the machine-readable copies live, so it does not have to scrape.
 */
export async function GET() {
  const base = siteUrl();
  const listings = await publishedListings(100);

  const body = [
    "# Bhumiraj Estates",
    "",
    "> Real-estate marketplace for Nepal. Ownership documents are verified against land-registry records before a property is published, and one appointed agent handles each listing end to end.",
    "",
    "Every property page has a plain-text copy at the same URL with `.md` appended.",
    "",
    "## Browse",
    "",
    `- [All properties for sale](${base}/search?type=SALE)`,
    `- [All properties to rent](${base}/search?type=RENT)`,
    `- [Verified agents](${base}/agents)`,
    `- [Sitemap](${base}/sitemap.xml)`,
    "",
    "## Published properties",
    "",
    ...listings.map(
      (listing) =>
        `- [${listing.title}](${base}/properties/${listing.slug}): plain text at ${base}/properties/${listing.slug}.md`,
    ),
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
