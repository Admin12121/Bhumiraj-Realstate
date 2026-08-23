-- Deposits are settled out of band (QR, bank transfer) and reviewed by staff,
-- so a deposit needs the receipt and the review outcome alongside the amount.
ALTER TABLE "AuctionDeposit"
  ADD COLUMN IF NOT EXISTS "mediaAssetId"    TEXT,
  ADD COLUMN IF NOT EXISTS "method"          TEXT,
  ADD COLUMN IF NOT EXISTS "reference"       TEXT,
  ADD COLUMN IF NOT EXISTS "submittedAt"     TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "reviewedAt"      TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "reviewedById"    TEXT,
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

ALTER TABLE "AuctionDeposit"
  ADD CONSTRAINT "AuctionDeposit_mediaAssetId_fkey"
  FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuctionDeposit"
  ADD CONSTRAINT "AuctionDeposit_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "AuctionDeposit_status_submittedAt_idx"
  ON "AuctionDeposit"("status", "submittedAt");
