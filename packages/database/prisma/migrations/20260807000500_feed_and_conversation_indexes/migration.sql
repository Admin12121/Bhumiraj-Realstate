-- Cursor-based social/profile feed and conversation ordering indexes.
CREATE INDEX IF NOT EXISTS "Listing_createdById_status_publishedAt_id_idx"
  ON "Listing"("createdById", "status", "publishedAt" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "Conversation_updatedAt_id_idx"
  ON "Conversation"("updatedAt" DESC, "id" DESC);
