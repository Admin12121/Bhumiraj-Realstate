-- Reports become tickets: they can be claimed by a staff member and carry a
-- conversation between the reporter and whoever is working it.

ALTER TABLE "ListingReport"
  ADD COLUMN "assignedToId" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "UserReport"
  ADD COLUMN "assignedToId" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "ListingReport"
  ADD CONSTRAINT "ListingReport_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE "UserReport"
  ADD CONSTRAINT "UserReport_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX "ListingReport_assignedToId_status_createdAt_idx"
  ON "ListingReport" ("assignedToId", "status", "createdAt");
CREATE INDEX "UserReport_assignedToId_status_createdAt_idx"
  ON "UserReport" ("assignedToId", "status", "createdAt");

CREATE TABLE "ReportMessage" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "listingReportId" TEXT,
  "userReportId" TEXT,
  "authorId" TEXT NOT NULL,
  "fromStaff" BOOLEAN NOT NULL DEFAULT false,
  "body" VARCHAR(4000) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReportMessage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ReportMessage"
  ADD CONSTRAINT "ReportMessage_listingReportId_fkey"
  FOREIGN KEY ("listingReportId") REFERENCES "ListingReport"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "ReportMessage"
  ADD CONSTRAINT "ReportMessage_userReportId_fkey"
  FOREIGN KEY ("userReportId") REFERENCES "UserReport"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "ReportMessage"
  ADD CONSTRAINT "ReportMessage_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

-- A message belongs to exactly one report, never both and never neither.
ALTER TABLE "ReportMessage"
  ADD CONSTRAINT "ReportMessage_one_report"
  CHECK (num_nonnulls("listingReportId", "userReportId") = 1);

CREATE INDEX "ReportMessage_listingReportId_createdAt_idx"
  ON "ReportMessage" ("listingReportId", "createdAt");
CREATE INDEX "ReportMessage_userReportId_createdAt_idx"
  ON "ReportMessage" ("userReportId", "createdAt");
