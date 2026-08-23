-- Staff can edit a listing from the console, so each edit records who and when.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LISTING_UPDATED';
