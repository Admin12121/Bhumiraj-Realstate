ALTER TABLE "Session"
  ADD COLUMN "authMethod" TEXT;

ALTER TABLE "TwoFactor"
  ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "failedVerificationCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil" TIMESTAMPTZ(3);

CREATE INDEX "Session_userId_authMethod_expiresAt_idx"
  ON "Session" ("userId", "authMethod", "expiresAt");
