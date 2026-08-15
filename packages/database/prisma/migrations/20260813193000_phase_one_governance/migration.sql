BEGIN;

CREATE TYPE "StaffMembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');
CREATE TYPE "PlatformInvitationType" AS ENUM ('STAFF', 'AGENT');
CREATE TYPE "PlatformInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
CREATE TYPE "AgentStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'RETIRED');
CREATE TYPE "AgentAvailabilityStatus" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'AT_CAPACITY');

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'STAFF_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PLATFORM_INVITATION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PLATFORM_INVITATION_REVOKED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PLATFORM_INVITATION_ACCEPTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AGENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AGENT_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AGENT_AVAILABILITY_CHANGED';

CREATE TABLE "StaffMembership" (
  "userId" TEXT NOT NULL,
  status "StaffMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "managedById" TEXT,
  "statusReason" VARCHAR(500),
  "activatedAt" TIMESTAMPTZ(3),
  "suspendedAt" TIMESTAMPTZ(3),
  "revokedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffMembership_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "PlatformInvitation" (
  id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  email VARCHAR(320) NOT NULL,
  type "PlatformInvitationType" NOT NULL,
  status "PlatformInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "tokenHash" CHAR(64) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "invitedById" TEXT NOT NULL,
  "acceptedById" TEXT,
  "acceptedAt" TIMESTAMPTZ(3),
  "revokedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformInvitation_pkey" PRIMARY KEY (id),
  CONSTRAINT "PlatformInvitation_email_normalized_check" CHECK (email = lower(trim(email))),
  CONSTRAINT "PlatformInvitation_expiry_check" CHECK ("expiresAt" > "createdAt")
);

CREATE TABLE "PlatformInvitationStaffRole" (
  "invitationId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  CONSTRAINT "PlatformInvitationStaffRole_pkey" PRIMARY KEY ("invitationId", "roleId")
);

CREATE UNIQUE INDEX "PlatformInvitation_tokenHash_key" ON "PlatformInvitation" ("tokenHash");
CREATE UNIQUE INDEX "PlatformInvitation_pending_email_type_key"
  ON "PlatformInvitation" (email, type)
  WHERE status = 'PENDING';
CREATE INDEX "PlatformInvitation_email_type_status_idx" ON "PlatformInvitation" (email, type, status);
CREATE INDEX "PlatformInvitation_status_expiresAt_idx" ON "PlatformInvitation" (status, "expiresAt");
CREATE INDEX "PlatformInvitation_invitedById_createdAt_idx" ON "PlatformInvitation" ("invitedById", "createdAt");
CREATE INDEX "PlatformInvitationStaffRole_roleId_invitationId_idx" ON "PlatformInvitationStaffRole" ("roleId", "invitationId");
CREATE INDEX "StaffMembership_status_createdAt_idx" ON "StaffMembership" (status, "createdAt");
CREATE INDEX "StaffMembership_managedById_updatedAt_idx" ON "StaffMembership" ("managedById", "updatedAt");

ALTER TABLE "StaffMembership"
  ADD CONSTRAINT "StaffMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StaffMembership_managedById_fkey" FOREIGN KEY ("managedById") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlatformInvitation"
  ADD CONSTRAINT "PlatformInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PlatformInvitation_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlatformInvitationStaffRole"
  ADD CONSTRAINT "PlatformInvitationStaffRole_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "PlatformInvitation"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PlatformInvitationStaffRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "StaffRole"(id) ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "StaffMembership" ("userId", status, "activatedAt")
SELECT id, 'ACTIVE', CURRENT_TIMESTAMP
FROM "User"
WHERE role = 'STAFF'
ON CONFLICT ("userId") DO NOTHING;

ALTER TABLE "AgentProfile"
  ADD COLUMN status "AgentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "availabilityStatus" "AgentAvailabilityStatus" NOT NULL DEFAULT 'UNAVAILABLE',
  ADD COLUMN "maxActiveCases" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "statusReason" VARCHAR(500),
  ADD COLUMN "suspendedAt" TIMESTAMPTZ(3),
  ADD COLUMN "retiredAt" TIMESTAMPTZ(3),
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "updatedById" TEXT,
  ADD CONSTRAINT "AgentProfile_maxActiveCases_check" CHECK ("maxActiveCases" >= 0 AND "maxActiveCases" <= 1000);

INSERT INTO "AgentProfile" (id, "userId", status, "availabilityStatus", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, id, 'PENDING', 'UNAVAILABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User"
WHERE role = 'AGENT'
ON CONFLICT ("userId") DO NOTHING;

UPDATE "AgentProfile"
SET status = CASE WHEN "verifiedAt" IS NOT NULL THEN 'ACTIVE'::"AgentStatus" ELSE 'PENDING'::"AgentStatus" END,
    "availabilityStatus" = CASE WHEN "verifiedAt" IS NOT NULL THEN 'AVAILABLE'::"AgentAvailabilityStatus" ELSE 'UNAVAILABLE'::"AgentAvailabilityStatus" END;

ALTER TABLE "AgentProfile"
  ADD CONSTRAINT "AgentProfile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "AgentProfile_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AgentProfile_status_availabilityStatus_createdAt_idx" ON "AgentProfile" (status, "availabilityStatus", "createdAt");
CREATE INDEX "AgentProfile_createdById_createdAt_idx" ON "AgentProfile" ("createdById", "createdAt");
CREATE INDEX "AgentProfile_updatedById_updatedAt_idx" ON "AgentProfile" ("updatedById", "updatedAt");

COMMIT;
