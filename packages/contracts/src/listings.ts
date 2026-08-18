import { z } from "zod";
import {
  cursorPageSchema,
  cursorQuerySchema,
  idSchema,
  isoDateSchema,
  bigintQuerySchema,
  moneySchema,
  positiveMinorAmountSchema,
  userIdSchema,
} from "./common";

export const listingStatusSchema = z.enum([
  "DRAFT",
  "AWAITING_PAYMENT",
  "PENDING_REVIEW",
  "AWAITING_AGENT",
  "PUBLISHED",
  "REJECTED",
  "WITHDRAWN",
  "ARCHIVED",
]);
export const listingTypeSchema = z.enum(["SALE", "RENT", "AUCTION"]);
export const propertyTypeSchema = z.enum([
  "HOUSE",
  "APARTMENT",
  "LAND",
  "COMMERCIAL",
  "OFFICE",
  "WAREHOUSE",
]);
export const rentPeriodSchema = z.enum(["DAY", "WEEK", "MONTH", "YEAR"]);

export const auctionCreationSchema = z
  .object({
    startingAmountMinor: positiveMinorAmountSchema,
    reserveAmountMinor: positiveMinorAmountSchema.nullable().optional(),
    minimumIncrementMinor: positiveMinorAmountSchema,
    startsAt: isoDateSchema,
    endsAt: isoDateSchema,
    extensionWindowSeconds: z.number().int().min(30).max(900).default(120),
    extensionDurationSeconds: z.number().int().min(30).max(900).default(120),
    maximumExtensionMinutes: z.number().int().min(0).max(180).default(30),
  })
  .superRefine((value, context) => {
    const startsAt = new Date(value.startsAt);
    const endsAt = new Date(value.endsAt);
    if (endsAt <= startsAt) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "Auction end time must be after the start time.",
      });
    }
    const startingAmount = BigInt(value.startingAmountMinor);
    const increment = BigInt(value.minimumIncrementMinor);
    if (startingAmount <= 0n) {
      context.addIssue({
        code: "custom",
        path: ["startingAmountMinor"],
        message: "Starting amount must be greater than zero.",
      });
    }
    if (increment <= 0n) {
      context.addIssue({
        code: "custom",
        path: ["minimumIncrementMinor"],
        message: "Minimum increment must be greater than zero.",
      });
    }
    if (
      value.reserveAmountMinor !== null &&
      value.reserveAmountMinor !== undefined &&
      BigInt(value.reserveAmountMinor) < startingAmount
    ) {
      context.addIssue({
        code: "custom",
        path: ["reserveAmountMinor"],
        message: "Reserve amount cannot be below the starting amount.",
      });
    }
  });

export const listingCardSchema = z.object({
  id: idSchema,
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  listingType: listingTypeSchema,
  propertyType: propertyTypeSchema,
  status: listingStatusSchema,
  price: moneySchema.nullable(),
  rentPeriod: rentPeriodSchema.nullable(),
  location: z.object({
    locality: z.string(),
    district: z.string(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
  }),
  specifications: z.object({
    bedrooms: z.number().int().nullable(),
    bathrooms: z.number().int().nullable(),
    areaSqFt: z.number().nullable(),
    parkingSpaces: z.number().int().nullable(),
  }),
  coverImageUrl: z.string().url().nullable(),
  imageCount: z.number().int().nonnegative(),
  favoriteCount: z.number().int().nonnegative(),
  viewCount: z.string().regex(/^\d+$/),
  isVerified: z.boolean(),
  isSaved: z.boolean().default(false),
  agent: z
    .object({
      id: userIdSchema,
      name: z.string(),
      image: z.string().url().nullable(),
      verified: z.boolean(),
    })
    .nullable(),
  publishedAt: isoDateSchema.nullable(),
  createdAt: isoDateSchema,
  auction: z
    .object({
      id: idSchema,
      status: z.string(),
      currentAmountMinor: z.string(),
      bidCount: z.number().int(),
      endsAt: isoDateSchema,
    })
    .nullable(),
});

export const listingFeedQuerySchema = cursorQuerySchema.extend({
  type: listingTypeSchema.optional(),
  propertyType: propertyTypeSchema.optional(),
  agentId: userIdSchema.optional(),
  province: z.string().trim().max(80).optional(),
  district: z.string().trim().max(80).optional(),
  minPriceMinor: bigintQuerySchema.optional(),
  maxPriceMinor: bigintQuerySchema.optional(),
  bedrooms: z.coerce.number().int().min(0).max(20).optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(["newest", "price-asc", "price-desc", "popular"]).default("newest"),
}).superRefine((value, context) => {
  if (
    value.minPriceMinor !== undefined &&
    value.maxPriceMinor !== undefined &&
    value.minPriceMinor > value.maxPriceMinor
  ) {
    context.addIssue({
      code: "custom",
      path: ["maxPriceMinor"],
      message: "Maximum price must be greater than or equal to minimum price.",
    });
  }
});

export const listingFeedResponseSchema = cursorPageSchema(listingCardSchema);

const listingBaseSchema = z.object({
  title: z.string().trim().min(10).max(160),
  description: z.string().trim().min(50).max(8000),
  listingType: listingTypeSchema,
  propertyType: propertyTypeSchema,
  price: moneySchema.nullable(),
  rentPeriod: rentPeriodSchema.nullable().default(null),
  auction: auctionCreationSchema.nullable().default(null),
  address: z.object({
    province: z.string().trim().min(2).max(80),
    district: z.string().trim().min(2).max(80),
    municipality: z.string().trim().min(2).max(100),
    ward: z.string().trim().max(20).optional(),
    locality: z.string().trim().min(2).max(120),
    street: z.string().trim().max(160).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    publicLocationPrecision: z
      .enum(["EXACT", "APPROXIMATE", "LOCALITY"])
      .default("APPROXIMATE"),
  }),
  specifications: z.object({
    bedrooms: z.number().int().min(0).max(50).optional(),
    bathrooms: z.number().int().min(0).max(50).optional(),
    kitchens: z.number().int().min(0).max(20).optional(),
    parkingSpaces: z.number().int().min(0).max(100).optional(),
    floors: z.number().int().min(0).max(100).optional(),
    areaSqFt: z.number().positive(),
    builtYear: z.number().int().min(1800).max(2100).optional(),
    furnishing: z
      .enum(["UNFURNISHED", "SEMI_FURNISHED", "FURNISHED"])
      .optional(),
  }),
  amenityIds: z.array(idSchema).max(100).default([]),
  mediaAssetIds: z.array(idSchema).min(1).max(50),
});

export const createListingSchema = listingBaseSchema.superRefine(
  (value, context) => {
    if (value.listingType === "AUCTION") {
      if (!value.auction) {
        context.addIssue({
          code: "custom",
          path: ["auction"],
          message: "Auction settings are required for auction listings.",
        });
      }
      if (value.price !== null) {
        context.addIssue({
          code: "custom",
          path: ["price"],
          message: "Auction listings do not use a fixed price.",
        });
      }
      if (value.rentPeriod !== null) {
        context.addIssue({
          code: "custom",
          path: ["rentPeriod"],
          message: "Auction listings cannot have a rent period.",
        });
      }
      return;
    }

    if (!value.price) {
      context.addIssue({
        code: "custom",
        path: ["price"],
        message: "A fixed price is required for sale and rent listings.",
      });
    }
    if (value.auction !== null) {
      context.addIssue({
        code: "custom",
        path: ["auction"],
        message: "Auction settings are only valid for auction listings.",
      });
    }
    if (value.listingType === "RENT" && value.rentPeriod === null) {
      context.addIssue({
        code: "custom",
        path: ["rentPeriod"],
        message: "A rent period is required for rental listings.",
      });
    }
    if (value.listingType === "SALE" && value.rentPeriod !== null) {
      context.addIssue({
        code: "custom",
        path: ["rentPeriod"],
        message: "Sale listings cannot have a rent period.",
      });
    }
  },
);

export const updateListingSchema = listingBaseSchema.partial();
export type ListingCard = z.infer<typeof listingCardSchema>;
export type ListingFeedQuery = z.infer<typeof listingFeedQuerySchema>;
export type CreateListingInput = z.infer<typeof createListingSchema>;

export const listingDetailSchema = listingCardSchema.extend({
  description: z.string(),
  media: z.array(
    z.object({
      id: idSchema,
      url: z.string().url(),
      altText: z.string().nullable(),
      position: z.number().int(),
    }),
  ),
  address: z.object({
    province: z.string(),
    district: z.string(),
    municipality: z.string(),
    ward: z.string().nullable(),
    locality: z.string(),
    street: z.string().nullable(),
  }),
  amenities: z.array(
    z.object({
      id: idSchema,
      name: z.string(),
      slug: z.string(),
      category: z.string(),
    }),
  ),
  ownershipVerified: z.boolean(),
  details: z.object({
    kitchens: z.number().int().nullable(),
    floors: z.number().nullable(),
    builtYear: z.number().int().nullable(),
    furnishing: z.string().nullable(),
    facing: z.string().nullable(),
    roadAccessFeet: z.number().nullable(),
    landAreaAana: z.number().nullable(),
  }),
});
export type ListingDetail = z.infer<typeof listingDetailSchema>;
