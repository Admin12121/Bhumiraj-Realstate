-- The enrolment deposit is set per auction: property values differ widely, so a
-- single platform-wide figure would be wrong for most of them.
ALTER TABLE "Auction" ADD COLUMN IF NOT EXISTS "depositAmountMinor" BIGINT;
