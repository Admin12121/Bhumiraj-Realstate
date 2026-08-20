import { HttpError } from "@real-estate/http";
import { ZodError } from "zod";

/**
 * Field paths rendered as the labels people actually see on the form. Anything
 * not listed falls back to a generic sentence rather than exposing the path.
 */
const FIELD_LABELS: Record<string, string> = {
  title: "Listing title",
  description: "Description",
  listingType: "Listing type",
  propertyType: "Property type",
  price: "Price",
  rentPeriod: "Rent period",
  "address.province": "Province",
  "address.district": "District",
  "address.municipality": "Municipality",
  "address.ward": "Ward",
  "address.locality": "Locality",
  "address.street": "Street",
  "address.latitude": "Map location",
  "address.longitude": "Map location",
  "specifications.areaSqFt": "Area",
  "specifications.bedrooms": "Bedrooms",
  "specifications.bathrooms": "Bathrooms",
  "specifications.kitchens": "Kitchens",
  "specifications.floors": "Floors",
  "specifications.parkingSpaces": "Parking spaces",
  "specifications.builtYear": "Year built",
  "specifications.furnishing": "Furnishing",
  mediaAssetIds: "Photos",
  auction: "Auction settings",
};

const GENERIC = "Something went wrong. Please try again.";

function labelFor(path: readonly PropertyKey[]): string | null {
  const key = path.filter((part) => typeof part !== "number").join(".");
  return FIELD_LABELS[key] ?? null;
}

/**
 * One readable sentence for a single validation issue.
 *
 * Zod's own text ("Too small: expected string to have >=10 characters") is
 * written for developers; these are written for the person filling the form.
 */
export function issueMessage(issue: {
  code: string;
  path: readonly PropertyKey[];
  message: string;
  minimum?: unknown;
  maximum?: unknown;
  origin?: string;
  type?: string;
}): string {
  const label = labelFor(issue.path);
  const subject = label ?? "This field";

  switch (issue.code) {
    case "too_small": {
      const minimum = Number(issue.minimum);
      if (!Number.isFinite(minimum)) return `${subject} is too short.`;
      if (issue.type === "array" || issue.origin === "array") {
        return minimum === 1
          ? `Add at least one ${subject.toLowerCase()}.`
          : `Add at least ${minimum} ${subject.toLowerCase()}.`;
      }
      if (minimum <= 1) return `${subject} is required.`;
      return `${subject} must be at least ${minimum} characters.`;
    }
    case "too_big": {
      const maximum = Number(issue.maximum);
      if (!Number.isFinite(maximum)) return `${subject} is too long.`;
      return `${subject} must be ${maximum} characters or fewer.`;
    }
    case "invalid_type":
      return `${subject} is required.`;
    case "invalid_format":
      return `${subject} is not in a valid format.`;
    default:
      // Custom issues carry messages the API authors wrote for people.
      return label ? `${label}: ${issue.message}` : issue.message;
  }
}

/** Every issue in a ZodError, keyed by dotted field path. */
export function fieldErrors(error: ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.filter((part) => typeof part !== "number").join(".");
    result[key] ??= issueMessage(issue as never);
  }
  return result;
}

/**
 * The text to show a user for any thrown error.
 *
 * Raw `ZodError.message` is a JSON dump of internal issue objects and
 * `Error.message` from an unexpected failure can carry internals, so neither is
 * ever shown as-is.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    const first = error.issues[0];
    return first ? issueMessage(first as never) : GENERIC;
  }
  if (error instanceof HttpError) {
    // The API envelope's `message` is written for end users; `details` is not
    // and is deliberately dropped here.
    if (error.status === 401) return "Please sign in and try again.";
    if (error.status === 403) return "You do not have access to do that.";
    if (error.status === 404) return "That item could not be found.";
    if (error.status === 429) return "Too many attempts. Please wait a moment.";
    if (error.status >= 500) return "The service is unavailable right now.";
    return error.message || GENERIC;
  }
  if (error instanceof Error) {
    // Messages thrown deliberately by our own UI code are short and readable;
    // anything long or JSON-shaped is a leak, so it is replaced.
    const text = error.message.trim();
    if (!text || text.length > 160 || text.startsWith("[") || text.startsWith("{")) {
      return GENERIC;
    }
    return text;
  }
  return GENERIC;
}
