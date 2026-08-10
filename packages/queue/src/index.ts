import { z } from "zod";
export const QUEUES = { OUTBOX: "outbox", AUCTIONS: "auctions", MEDIA: "media", NOTIFICATIONS: "notifications", INTEGRATIONS: "integrations" } as const;
export const outboxJobSchema = z.object({ eventId: z.string() });
export const closeAuctionJobSchema = z.object({ auctionId: z.string() });
export const processMediaJobSchema = z.object({ assetId: z.uuid() });
export const purgePersonalMediaJobSchema = z.object({ userId: z.uuid() });
