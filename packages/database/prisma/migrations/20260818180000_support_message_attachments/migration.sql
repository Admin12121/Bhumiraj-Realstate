-- Written by hand rather than taken from `prisma migrate diff`: that differ
-- also wants to drop the trigram/GIN/search indexes (created by raw SQL in
-- earlier migrations, so invisible to the schema) and to strip the `id`
-- defaults from every table (a Prisma 7 artifact). Neither belongs here.

ALTER TABLE "SupportMessage"
  ADD COLUMN "attachmentId" TEXT,
  ADD COLUMN "flaggedReason" VARCHAR(200);

-- SET NULL rather than CASCADE: losing the image must not erase the message,
-- which staff may still need for context.
ALTER TABLE "SupportMessage"
  ADD CONSTRAINT "SupportMessage_attachmentId_fkey"
  FOREIGN KEY ("attachmentId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SupportMessage_flaggedReason_idx" ON "SupportMessage" ("flaggedReason");
