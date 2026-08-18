-- Written by hand rather than taken from `prisma migrate diff`: that differ
-- also wants to drop the trigram/GIN/search indexes (created by raw SQL in
-- earlier migrations, so invisible to the schema) and to strip the `id`
-- defaults from every table (a Prisma 7 artifact). Neither belongs here.

-- A viewing is handled by the agent representing the listing, not by whoever
-- submitted it, so the request records the agent and their response.
ALTER TABLE "ViewingRequest"
  ADD COLUMN "agentId" TEXT,
  ADD COLUMN "durationMinutes" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "responseNote" VARCHAR(500),
  ADD COLUMN "respondedAt" TIMESTAMPTZ(3);

ALTER TABLE "ViewingRequest"
  ADD CONSTRAINT "ViewingRequest_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "AgentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ViewingRequest_agentId_status_scheduledAt_idx"
  ON "ViewingRequest" ("agentId", "status", "scheduledAt");

-- Recurring weekly availability. Minutes are local to Asia/Kathmandu, which
-- has no daylight saving, so the UTC offset is constant.
CREATE TABLE "AgentAvailabilityWindow" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "AgentAvailabilityWindow_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AgentAvailabilityWindow"
  ADD CONSTRAINT "AgentAvailabilityWindow_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "AgentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Guard rails the application also enforces, kept here so a bad row cannot be
-- written by a migration, a fixture, or a console session.
ALTER TABLE "AgentAvailabilityWindow"
  ADD CONSTRAINT "AgentAvailabilityWindow_dayOfWeek_check"
  CHECK ("dayOfWeek" BETWEEN 0 AND 6);

ALTER TABLE "AgentAvailabilityWindow"
  ADD CONSTRAINT "AgentAvailabilityWindow_minutes_check"
  CHECK (
    "startMinute" >= 0
    AND "endMinute" <= 1440
    AND "startMinute" < "endMinute"
  );

CREATE UNIQUE INDEX "AgentAvailabilityWindow_agentId_dayOfWeek_startMinute_key"
  ON "AgentAvailabilityWindow" ("agentId", "dayOfWeek", "startMinute");

CREATE INDEX "AgentAvailabilityWindow_agentId_dayOfWeek_idx"
  ON "AgentAvailabilityWindow" ("agentId", "dayOfWeek");
