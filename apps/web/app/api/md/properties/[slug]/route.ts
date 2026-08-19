import { listingToMarkdown } from "@/shared/seo/listing-markdown";
import { listingDetail, siteUrl } from "@/shared/seo/public-catalogue";

export const revalidate = 900;

/**
 * Serves `/properties/<slug>.md`, which proxy.ts rewrites here. Assistants that
 * prefer plain text get the same facts as the page without parsing markup.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const listing = await listingDetail(slug);

  if (!listing) {
    return new Response("# Not found\n\nNo published property has that link.\n", {
      status: 404,
      headers: { "content-type": "text/markdown; charset=utf-8" },
    });
  }

  return new Response(listingToMarkdown(listing, siteUrl()), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
