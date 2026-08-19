import {
  listingFeedResponseSchema,
  publicAgentsResponseSchema,
  type ListingDetail,
} from "@real-estate/contracts";
import { createApiBaseUrl } from "@real-estate/http";

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost").replace(
    /\/$/,
    "",
  );
}

/**
 * Server-side reads for crawler surfaces. These run without a session, so they
 * only ever see what is already public, and a failure degrades to an empty list
 * rather than taking the sitemap down.
 */
async function readJson(path: string): Promise<unknown | null> {
  try {
    const response = await fetch(`${createApiBaseUrl()}${path}`, {
      headers: { accept: "application/json" },
      next: { revalidate: 900 },
    });
    if (!response.ok) return null;
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

export type CatalogueListing = {
  slug: string;
  title: string;
  publishedAt: string | null;
  createdAt: string;
};

/** Every published listing, paged through so the sitemap is not truncated. */
export async function publishedListings(
  limit = 1_000,
): Promise<CatalogueListing[]> {
  const items: CatalogueListing[] = [];
  let cursor: string | undefined;

  while (items.length < limit) {
    const query = new URLSearchParams({ limit: "50", sort: "newest" });
    if (cursor) query.set("cursor", cursor);

    const raw = await readJson(`/listings?${query.toString()}`);
    const parsed = listingFeedResponseSchema.safeParse(raw);
    if (!parsed.success) break;

    for (const listing of parsed.data.items) {
      items.push({
        slug: listing.slug,
        title: listing.title,
        publishedAt: listing.publishedAt,
        createdAt: listing.createdAt,
      });
    }

    if (!parsed.data.nextCursor) break;
    cursor = parsed.data.nextCursor;
  }

  return items;
}

export type CatalogueAgent = {
  userId: string;
  username: string | null;
  name: string;
};

export async function publicAgents(limit = 500): Promise<CatalogueAgent[]> {
  const items: CatalogueAgent[] = [];
  let cursor: string | undefined;

  while (items.length < limit) {
    const query = new URLSearchParams({ limit: "50" });
    if (cursor) query.set("cursor", cursor);

    const raw = await readJson(`/profiles/agents?${query.toString()}`);
    const parsed = publicAgentsResponseSchema.safeParse(raw);
    if (!parsed.success) break;

    for (const agent of parsed.data.items) {
      items.push({
        userId: agent.userId,
        username: agent.username,
        name: agent.name,
      });
    }

    if (!parsed.data.nextCursor) break;
    cursor = parsed.data.nextCursor;
  }

  return items;
}

export async function listingDetail(
  slug: string,
): Promise<ListingDetail | null> {
  const raw = await readJson(`/listings/${encodeURIComponent(slug)}`);
  if (!raw || typeof raw !== "object") return null;
  return raw as ListingDetail;
}
