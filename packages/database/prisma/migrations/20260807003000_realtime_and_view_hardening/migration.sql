-- Separate auction event ordering from bid ordering and make listing-view counting idempotent per viewer/day.
ALTER TABLE "Auction" ADD COLUMN "eventSequence" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ListingView" ADD COLUMN "viewerKey" TEXT;
ALTER TABLE "ListingView" ADD COLUMN "viewDate" DATE;

UPDATE "ListingView"
SET "viewerKey" = COALESCE("userId", "visitorHash", 'legacy:' || "id"::text),
    "viewDate" = ("occurredAt" AT TIME ZONE 'UTC')::date;

ALTER TABLE "ListingView" ALTER COLUMN "viewerKey" SET NOT NULL;
ALTER TABLE "ListingView" ALTER COLUMN "viewDate" SET NOT NULL;

CREATE UNIQUE INDEX "ListingView_listingId_viewerKey_viewDate_key"
  ON "ListingView"("listingId", "viewerKey", "viewDate");
