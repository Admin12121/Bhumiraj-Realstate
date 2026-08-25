import type { ListingDetail } from "@real-estate/contracts";
import { formatMinorAmount } from "@/shared/utilities/money";

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  HOUSE: "House",
  APARTMENT: "Apartment",
  LAND: "Land",
  COMMERCIAL: "Commercial",
  OFFICE: "Office",
  WAREHOUSE: "Warehouse",
};

function humanise(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function row(label: string, value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  return `| ${label} | ${value} |`;
}

/**
 * A plain-text rendering of one listing for assistants and crawlers that would
 * otherwise have to infer the facts from markup.
 */
export function listingToMarkdown(
  listing: ListingDetail,
  siteUrl: string,
): string {
  const url = `${siteUrl}/properties/${listing.slug}`;
  const price = listing.price
    ? formatMinorAmount(listing.price.amountMinor, listing.price.currency)
    : "Price on request";
  const specs = listing.specifications;
  const extra = listing.details;

  const facts = [
    row("Listing type", humanise(listing.listingType)),
    row(
      "Property type",
      PROPERTY_TYPE_LABELS[listing.propertyType] ??
        humanise(listing.propertyType),
    ),
    row("Price", price),
    row(
      "Rent period",
      listing.rentPeriod ? humanise(listing.rentPeriod) : null,
    ),
    row(
      "Built-up area",
      specs.areaSqFt ? `${specs.areaSqFt.toLocaleString("en-IN")} sq ft` : null,
    ),
    row(
      "Land area",
      extra.landAreaAana
        ? `${extra.landAreaAana.toLocaleString("en-IN")} aana`
        : null,
    ),
    row("Bedrooms", specs.bedrooms?.toString()),
    row("Bathrooms", specs.bathrooms?.toString()),
    row("Kitchens", extra.kitchens?.toString()),
    row("Parking spaces", specs.parkingSpaces?.toString()),
    row("Storeys", extra.floors?.toString()),
    row(
      "Road access",
      extra.roadAccessFeet ? `${extra.roadAccessFeet} ft` : null,
    ),
    row("Built year", extra.builtYear?.toString()),
    row("Facing", extra.facing),
    row("Furnishing", extra.furnishing ? humanise(extra.furnishing) : null),
    row(
      "Ownership documents",
      listing.ownershipVerified
        ? "Verified against land-registry records"
        : "Not yet verified",
    ),
  ].filter((line): line is string => line !== null);

  const address = [
    listing.address.street,
    listing.address.locality,
    listing.address.ward ? `Ward ${listing.address.ward}` : null,
    listing.address.municipality,
    listing.address.district,
    listing.address.province,
    "Nepal",
  ].filter(Boolean);

  const lines: string[] = [
    `# ${listing.title}`,
    "",
    `> ${price} · ${listing.location.locality}, ${listing.location.district} · Listed on Bhumiraj Estates`,
    "",
    `- Canonical page: ${url}`,
    `- Listing reference: ${listing.id}`,
    listing.publishedAt ? `- Published: ${listing.publishedAt}` : null,
    "",
    "## Description",
    "",
    listing.description,
    "",
    "## Facts",
    "",
    "| Field | Value |",
    "| --- | --- |",
    ...facts,
    "",
    "## Location",
    "",
    address.join(", "),
  ].filter((line): line is string => line !== null);

  if (listing.location.latitude != null && listing.location.longitude != null) {
    lines.push(
      "",
      `Approximate coordinates: ${listing.location.latitude}, ${listing.location.longitude}`,
    );
  }

  if (listing.amenities.length > 0) {
    lines.push(
      "",
      "## Amenities",
      "",
      ...listing.amenities.map((amenity) => `- ${amenity.name}`),
    );
  }

  lines.push(
    "",
    "## Agent",
    "",
    listing.agent
      ? `${listing.agent.name}${listing.agent.verified ? " (verified by Bhumiraj)" : ""} — ${siteUrl}/agents/${listing.agent.username ?? listing.agent.id}`
      : "No agent is representing this property yet.",
  );

  if (listing.media.length > 0) {
    lines.push(
      "",
      "## Photos",
      "",
      ...listing.media.map(
        (item, index) => `- ![${item.altText ?? `Photo ${index + 1}`}](${item.url})`,
      ),
    );
  }

  lines.push(
    "",
    "---",
    "",
    "Bhumiraj Estates verifies ownership documents against land-registry records before publishing, and appoints one agent per property to handle viewing, negotiation and transfer.",
    "",
  );

  return lines.join("\n");
}
