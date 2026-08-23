-- Approving or rejecting a bidder is a staff decision worth its own audit trail.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AUCTION_ENROLMENT_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AUCTION_ENROLMENT_REJECTED';
