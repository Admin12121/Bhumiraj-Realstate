-- Better Auth manages one two-factor record per user.
-- Remove stale duplicate enrollments deterministically before enforcing uniqueness.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY "userId"
           ORDER BY verified DESC,
                    CASE WHEN "lockedUntil" IS NULL THEN 0 ELSE 1 END ASC,
                    id DESC
         ) AS row_number
  FROM "TwoFactor"
)
DELETE FROM "TwoFactor"
WHERE id IN (SELECT id FROM ranked WHERE row_number > 1);

DROP INDEX IF EXISTS "TwoFactor_userId_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "TwoFactor_userId_key"
  ON "TwoFactor" ("userId");
