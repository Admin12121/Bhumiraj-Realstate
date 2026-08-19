import type { MetadataRoute } from "next";
import { NEPAL_PROVINCES } from "@real-estate/contracts";
import {
  publicAgents,
  publishedListings,
  siteUrl,
} from "@/shared/seo/public-catalogue";

export const revalidate = 900;

/**
 * Every public URL worth indexing: the marketplace entry points, one search
 * page per district so regional queries land somewhere real, and each published
 * listing and agent.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    {
      url: `${base}/search?type=SALE`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${base}/search?type=RENT`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${base}/agents`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${base}/post-property`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    ...["/about", "/blog", "/contact", "/support", "/legal"].map((path) => ({
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
    ...["/legal/terms", "/legal/privacy"].map((path) => ({
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];

  const districtRoutes: MetadataRoute.Sitemap = NEPAL_PROVINCES.flatMap(
    (province) =>
      province.districts.map((district) => ({
        url: `${base}/search?type=SALE&province=${encodeURIComponent(province.name)}&district=${encodeURIComponent(district)}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
  );

  const [listings, agents] = await Promise.all([
    publishedListings(),
    publicAgents(),
  ]);

  const listingRoutes: MetadataRoute.Sitemap = listings.map((listing) => ({
    url: `${base}/properties/${listing.slug}`,
    lastModified: new Date(listing.publishedAt ?? listing.createdAt),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const agentRoutes: MetadataRoute.Sitemap = agents.map((agent) => ({
    url: `${base}/agents/${agent.username ?? agent.userId}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [
    ...staticRoutes,
    ...districtRoutes,
    ...listingRoutes,
    ...agentRoutes,
  ];
}
