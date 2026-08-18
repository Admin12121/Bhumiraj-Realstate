-- Listing fee payment proofs and agent assignment.
--
-- Written by hand rather than taken from `prisma migrate diff`: that differ
-- also wants to drop the trigram/GIN/search indexes (created by raw SQL in
-- earlier migrations, so invisible to the schema) and to strip the `id`
-- defaults from every table (a Prisma 7 artifact). Neither belongs here.
-- This migration is purely additive.

-- CreateEnum
CREATE TYPE "PaymentProofStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ListingAssignmentStatus" AS ENUM ('OFFERED', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED');

-- AlterEnum: new waypoints in the listing lifecycle.
ALTER TYPE "ListingStatus" ADD VALUE IF NOT EXISTS 'AWAITING_PAYMENT';
ALTER TYPE "ListingStatus" ADD VALUE IF NOT EXISTS 'AWAITING_AGENT';

-- CreateTable
CREATE TABLE "ListingPaymentProof" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "paymentIntentId" TEXT,
    "mediaAssetId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "reference" VARCHAR(120),
    "amountMinor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "PaymentProofStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMPTZ(3),
    "rejectionReason" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ListingPaymentProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingAssignment" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "status" "ListingAssignmentStatus" NOT NULL DEFAULT 'OFFERED',
    "offeredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3),
    "responseNote" VARCHAR(500),
    "revokedById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ListingAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListingPaymentProof_paymentIntentId_key" ON "ListingPaymentProof"("paymentIntentId");
CREATE UNIQUE INDEX "ListingPaymentProof_mediaAssetId_key" ON "ListingPaymentProof"("mediaAssetId");
CREATE INDEX "ListingPaymentProof_status_createdAt_idx" ON "ListingPaymentProof"("status", "createdAt");
CREATE INDEX "ListingPaymentProof_listingId_createdAt_idx" ON "ListingPaymentProof"("listingId", "createdAt" DESC);
CREATE INDEX "ListingPaymentProof_submittedById_createdAt_idx" ON "ListingPaymentProof"("submittedById", "createdAt" DESC);
CREATE INDEX "ListingPaymentProof_reviewedById_reviewedAt_idx" ON "ListingPaymentProof"("reviewedById", "reviewedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ListingAssignment_listingId_agentId_offeredAt_key" ON "ListingAssignment"("listingId", "agentId", "offeredAt");
CREATE INDEX "ListingAssignment_agentId_status_offeredAt_idx" ON "ListingAssignment"("agentId", "status", "offeredAt" DESC);
CREATE INDEX "ListingAssignment_listingId_status_offeredAt_idx" ON "ListingAssignment"("listingId", "status", "offeredAt" DESC);
CREATE INDEX "ListingAssignment_status_expiresAt_idx" ON "ListingAssignment"("status", "expiresAt");
CREATE INDEX "ListingAssignment_assignedById_createdAt_idx" ON "ListingAssignment"("assignedById", "createdAt" DESC);
CREATE INDEX "ListingAssignment_revokedById_updatedAt_idx" ON "ListingAssignment"("revokedById", "updatedAt" DESC);

-- AddForeignKey
ALTER TABLE "ListingPaymentProof" ADD CONSTRAINT "ListingPaymentProof_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingPaymentProof" ADD CONSTRAINT "ListingPaymentProof_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ListingPaymentProof" ADD CONSTRAINT "ListingPaymentProof_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ListingPaymentProof" ADD CONSTRAINT "ListingPaymentProof_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ListingPaymentProof" ADD CONSTRAINT "ListingPaymentProof_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingAssignment" ADD CONSTRAINT "ListingAssignment_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingAssignment" ADD CONSTRAINT "ListingAssignment_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ListingAssignment" ADD CONSTRAINT "ListingAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ListingAssignment" ADD CONSTRAINT "ListingAssignment_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterEnum: payment screenshots are private documents, not listing imagery.
ALTER TYPE "MediaPurpose" ADD VALUE IF NOT EXISTS 'PAYMENT_PROOF';

-- Agent caseload: hard limit raised to 20 (the UI warns from 10).
ALTER TABLE "AgentProfile" ALTER COLUMN "maxActiveCases" SET DEFAULT 20;

-- AlterEnum: audit trail for the payment and assignment decisions.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LISTING_PAYMENT_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LISTING_PAYMENT_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LISTING_PAYMENT_REJECTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LISTING_AGENT_ASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LISTING_AGENT_ACCEPTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LISTING_AGENT_DECLINED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LISTING_AGENT_ASSIGNMENT_REVOKED';
