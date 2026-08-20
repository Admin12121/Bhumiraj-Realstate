-- Admin-uploaded QR codes are shown to sellers on the payment screen, so they
-- need their own purpose: unlike PAYMENT_PROOF they are meant to be public.
ALTER TYPE "MediaPurpose" ADD VALUE IF NOT EXISTS 'PAYMENT_QR';
