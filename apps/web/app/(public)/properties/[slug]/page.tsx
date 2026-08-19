import type { Metadata } from "next";
import { listingDetail, siteUrl } from "@/shared/seo/public-catalogue";
import { formatMinorAmount } from "@/shared/utilities/money";
import { PropertyPage } from "./_components/property-page";

type Params = { params: Promise<{ slug: string }> };

/**
 * Resolved on the server so a crawler sees the real title, description and
 * canonical URL in the HTML rather than a shell the client fills in later.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const listing = await listingDetail(slug);
  if (!listing) return { title: "Property not found" };

  const price = listing.price
    ? formatMinorAmount(listing.price.amountMinor, listing.price.currency)
    : "Price on request";
  const where = `${listing.location.locality}, ${listing.location.district}`;
  const description = `${price} · ${where}. ${listing.description}`.slice(
    0,
    300,
  );
  const url = `${siteUrl()}/properties/${listing.slug}`;
  const image = listing.media[0]?.url ?? listing.coverImageUrl;

  return {
    title: `${listing.title} · ${where}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title: listing.title,
      description,
      ...(image ? { images: [{ url: image }] } : {}),
    },
  };
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  const listing = await listingDetail(slug);

  // schema.org so assistants and search engines read the price, address and
  // agent as data instead of inferring them from the layout.
  const jsonLd = listing
    ? {
        "@context": "https://schema.org",
        "@type": "RealEstateListing",
        name: listing.title,
        description: listing.description,
        url: `${siteUrl()}/properties/${listing.slug}`,
        datePosted: listing.publishedAt ?? listing.createdAt,
        ...(listing.media.length
          ? { image: listing.media.map((item) => item.url) }
          : {}),
        ...(listing.price
          ? {
              offers: {
                "@type": "Offer",
                price: (
                  BigInt(listing.price.amountMinor) / 100n
                ).toString(),
                priceCurrency: listing.price.currency,
                availability: "https://schema.org/InStock",
              },
            }
          : {}),
        address: {
          "@type": "PostalAddress",
          streetAddress: listing.address.street ?? listing.address.locality,
          addressLocality: listing.address.municipality,
          addressRegion: listing.address.province,
          addressCountry: "NP",
        },
        ...(listing.location.latitude != null &&
        listing.location.longitude != null
          ? {
              geo: {
                "@type": "GeoCoordinates",
                latitude: listing.location.latitude,
                longitude: listing.location.longitude,
              },
            }
          : {}),
        ...(listing.agent
          ? {
              agent: {
                "@type": "RealEstateAgent",
                name: listing.agent.name,
                url: `${siteUrl()}/agents/${listing.agent.username ?? listing.agent.id}`,
              },
            }
          : {}),
      }
    : null;

  return (
    <>
      {jsonLd ? (
        <script
          type="application/ld+json"
          // The payload is built from typed API data, not user-supplied markup.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
      <PropertyPage slug={slug} />
    </>
  );
}
