-- Inline blur placeholder so a card can paint immediately, without a second
-- network round trip just to show a low-quality preview.
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "blurDataUrl" VARCHAR(4000);
