-- Marketplace counters, missing relational constraints, auction status history, and settings.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REPORT_REVIEWED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SETTINGS_UPDATED';

ALTER TABLE "AgentProfile"
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Listing"
  ADD COLUMN IF NOT EXISTS "favoriteCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "inquiryCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "viewCount" BIGINT NOT NULL DEFAULT 0;

UPDATE "Listing" l
SET "favoriteCount" = COALESCE(f.c, 0)
FROM (
  SELECT "listingId", COUNT(*)::integer AS c
  FROM "Favorite"
  GROUP BY "listingId"
) f
WHERE l.id = f."listingId";

UPDATE "Listing" l
SET "inquiryCount" = COALESCE(i.c, 0)
FROM (
  SELECT "listingId", COUNT(*)::integer AS c
  FROM "ListingInquiry"
  GROUP BY "listingId"
) i
WHERE l.id = i."listingId";

UPDATE "Listing" l
SET "viewCount" = COALESCE(v.c, 0)
FROM (
  SELECT "listingId", COUNT(*)::bigint AS c
  FROM "ListingView"
  GROUP BY "listingId"
) v
WHERE l.id = v."listingId";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'IdentityVerification_reviewedById_fkey'
  ) THEN
    ALTER TABLE "IdentityVerification"
      ADD CONSTRAINT "IdentityVerification_reviewedById_fkey"
      FOREIGN KEY ("reviewedById") REFERENCES "User"(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ListingInquiry_assignedAgentId_fkey'
  ) THEN
    ALTER TABLE "ListingInquiry"
      ADD CONSTRAINT "ListingInquiry_assignedAgentId_fkey"
      FOREIGN KEY ("assignedAgentId") REFERENCES "User"(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "IdentityVerification_reviewedById_status_idx"
  ON "IdentityVerification"("reviewedById", status);
CREATE INDEX IF NOT EXISTS "Listing_status_popularity_idx"
  ON "Listing"(status, "favoriteCount" DESC, "viewCount" DESC, "publishedAt" DESC, id DESC);

CREATE TABLE IF NOT EXISTS "AuctionStatusHistory" (
  id TEXT PRIMARY KEY,
  "auctionId" TEXT NOT NULL,
  "fromStatus" "AuctionStatus",
  "toStatus" "AuctionStatus" NOT NULL,
  reason TEXT,
  "actorId" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuctionStatusHistory_auctionId_fkey"
    FOREIGN KEY ("auctionId") REFERENCES "Auction"(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AuctionStatusHistory_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"(id)
    ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AuctionStatusHistory_auctionId_createdAt_idx"
  ON "AuctionStatusHistory"("auctionId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AuctionStatusHistory_actorId_createdAt_idx"
  ON "AuctionStatusHistory"("actorId", "createdAt" DESC);

INSERT INTO "AuctionStatusHistory" (id, "auctionId", "fromStatus", "toStatus", reason, "createdAt")
SELECT gen_random_uuid()::text, a.id, NULL, a.status, 'Backfilled current auction state.', a."createdAt"
FROM "Auction" a
WHERE NOT EXISTS (
  SELECT 1 FROM "AuctionStatusHistory" h WHERE h."auctionId" = a.id
);

CREATE TABLE IF NOT EXISTS "SystemSetting" (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SystemSetting_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"(id)
    ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "SystemSetting_updatedById_updatedAt_idx"
  ON "SystemSetting"("updatedById", "updatedAt" DESC);
