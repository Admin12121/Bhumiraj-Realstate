-- Public agent-directory ranking and bounded case-insensitive search.
CREATE INDEX IF NOT EXISTS "AgentProfile_public_rank_idx"
  ON "AgentProfile"("averageRating" DESC, "reviewCount" DESC, id DESC)
  WHERE "verifiedAt" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "User_name_trgm_idx"
  ON "User" USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "UserProfile_username_trgm_idx"
  ON "UserProfile" USING GIN (username gin_trgm_ops)
  WHERE username IS NOT NULL;
