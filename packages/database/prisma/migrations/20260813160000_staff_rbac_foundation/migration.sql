-- Separate the four hardcoded account types from staff-only custom RBAC.
BEGIN;

-- Preserve one oldest SUPER_ADMIN as OWNER and migrate any additional owners
-- into STAFF so the database can enforce a single application owner.
CREATE TEMP TABLE "_LegacyStaffTypes" AS
SELECT id AS "userId", role
FROM "User"
WHERE role IN ('SUPER_ADMIN', 'ADMIN', 'MODERATOR');

WITH ranked_owners AS (
  SELECT id, row_number() OVER (ORDER BY "createdAt", id) AS owner_rank
  FROM "User"
  WHERE role = 'SUPER_ADMIN'
)
UPDATE "User" AS u
SET role = 'ADMIN'
FROM ranked_owners AS ranked
WHERE u.id = ranked.id AND ranked.owner_rank > 1;

CREATE TYPE "AccountType" AS ENUM ('OWNER', 'STAFF', 'AGENT', 'USER');

ALTER TABLE "User" ALTER COLUMN role DROP DEFAULT;
ALTER TABLE "User"
  ALTER COLUMN role TYPE "AccountType"
  USING (
    CASE
      WHEN role = 'SUPER_ADMIN' THEN 'OWNER'
      WHEN role IN ('ADMIN', 'MODERATOR') THEN 'STAFF'
      WHEN role = 'AGENT' THEN 'AGENT'
      ELSE 'USER'
    END
  )::"AccountType";
ALTER TABLE "User" ALTER COLUMN role SET DEFAULT 'USER';

CREATE UNIQUE INDEX "User_single_owner_key" ON "User" (role) WHERE role = 'OWNER';

CREATE TABLE "StaffRole" (
  id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  name VARCHAR(80) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  description VARCHAR(500),
  color VARCHAR(20) NOT NULL DEFAULT '#64748b',
  position INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffRole_pkey" PRIMARY KEY (id),
  CONSTRAINT "StaffRole_position_check" CHECK (position >= 0 AND position <= 999),
  CONSTRAINT "StaffRole_color_check" CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE TABLE "StaffPermission" (
  id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  key VARCHAR(120) NOT NULL,
  label VARCHAR(120) NOT NULL,
  "group" VARCHAR(80) NOT NULL,
  description VARCHAR(500),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffPermission_pkey" PRIMARY KEY (id),
  CONSTRAINT "StaffPermission_key_check" CHECK (key ~ '^[a-z][a-z0-9]*(\.[a-z][a-z0-9_-]*)+$')
);

CREATE TABLE "StaffRolePermission" (
  "roleId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffRolePermission_pkey" PRIMARY KEY ("roleId", "permissionId")
);

CREATE TABLE "StaffUserRole" (
  "userId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "grantedById" TEXT,
  "grantedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffUserRole_pkey" PRIMARY KEY ("userId", "roleId")
);

CREATE UNIQUE INDEX "StaffRole_slug_key" ON "StaffRole" (slug);
CREATE INDEX "StaffRole_position_name_idx" ON "StaffRole" (position DESC, name);
CREATE INDEX "StaffRole_createdById_createdAt_idx" ON "StaffRole" ("createdById", "createdAt");
CREATE INDEX "StaffRole_updatedById_updatedAt_idx" ON "StaffRole" ("updatedById", "updatedAt");
CREATE UNIQUE INDEX "StaffPermission_key_key" ON "StaffPermission" (key);
CREATE INDEX "StaffPermission_group_label_idx" ON "StaffPermission" ("group", label);
CREATE INDEX "StaffRolePermission_permissionId_roleId_idx" ON "StaffRolePermission" ("permissionId", "roleId");
CREATE INDEX "StaffUserRole_roleId_userId_idx" ON "StaffUserRole" ("roleId", "userId");
CREATE INDEX "StaffUserRole_grantedById_grantedAt_idx" ON "StaffUserRole" ("grantedById", "grantedAt");

ALTER TABLE "StaffRole"
  ADD CONSTRAINT "StaffRole_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "StaffRole_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StaffRolePermission"
  ADD CONSTRAINT "StaffRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "StaffRole"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StaffRolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "StaffPermission"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffUserRole"
  ADD CONSTRAINT "StaffUserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StaffUserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "StaffRole"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StaffUserRole_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ACCOUNT_TYPE_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'STAFF_ROLE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'STAFF_ROLE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'STAFF_ROLE_DELETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'STAFF_ROLE_PERMISSIONS_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'STAFF_ROLE_ASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'STAFF_ROLE_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'STAFF_MEMBER_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'OWNER_TRANSFERRED';

-- Code-owned permission catalogue. Runtime synchronization updates labels and
-- removes permissions no longer registered by a feature.
INSERT INTO "StaffPermission" (id, key, label, "group", description) VALUES
  (gen_random_uuid()::text, 'admin.overview.read', 'View dashboard', 'Overview', 'View administration metrics and recent activity.'),
  (gen_random_uuid()::text, 'admin.users.read', 'View users', 'Users', 'Search and inspect customer accounts.'),
  (gen_random_uuid()::text, 'admin.users.status.manage', 'Manage user status', 'Users', 'Suspend and restore customer accounts.'),
  (gen_random_uuid()::text, 'admin.users.type.manage', 'Manage account types', 'Users', 'Create or revoke agent accounts. Staff and owner governance remain separately protected.'),
  (gen_random_uuid()::text, 'admin.staff.read', 'View staff', 'Staff', 'View staff members and their assigned roles.'),
  (gen_random_uuid()::text, 'admin.staff.manage', 'Manage staff', 'Staff', 'Create staff and assign roles below the actor hierarchy.'),
  (gen_random_uuid()::text, 'admin.roles.read', 'View staff roles', 'Staff roles', 'View staff roles and registered permissions.'),
  (gen_random_uuid()::text, 'admin.roles.manage', 'Manage staff roles', 'Staff roles', 'Create and edit roles below the actor hierarchy.'),
  (gen_random_uuid()::text, 'admin.listings.read', 'View listings', 'Listings', 'View the administration listing queue.'),
  (gen_random_uuid()::text, 'admin.listings.moderate', 'Moderate listings', 'Listings', 'Publish or reject submitted listings.'),
  (gen_random_uuid()::text, 'admin.auctions.read', 'View auctions', 'Auctions', 'View auction operations and status.'),
  (gen_random_uuid()::text, 'admin.auctions.manage', 'Manage auctions', 'Auctions', 'Pause, resume, or cancel auctions.'),
  (gen_random_uuid()::text, 'admin.moderation.read', 'View reports', 'Moderation', 'View user and listing reports.'),
  (gen_random_uuid()::text, 'admin.moderation.manage', 'Resolve reports', 'Moderation', 'Review and resolve user and listing reports.'),
  (gen_random_uuid()::text, 'admin.agents.read', 'View agents', 'Agents', 'View platform agent profiles.'),
  (gen_random_uuid()::text, 'admin.agents.manage', 'Manage agents', 'Agents', 'Create, verify, suspend, or retire platform agents.'),
  (gen_random_uuid()::text, 'admin.messages.read', 'View support messages', 'Messages', 'View platform support conversations.'),
  (gen_random_uuid()::text, 'admin.audit.read', 'View audit log', 'Security', 'View immutable administrative audit events.'),
  (gen_random_uuid()::text, 'admin.media.private.read', 'View private media', 'Security', 'Access private media for authorized review.'),
  (gen_random_uuid()::text, 'admin.settings.read', 'View settings', 'Settings', 'View platform configuration.'),
  (gen_random_uuid()::text, 'admin.settings.manage', 'Manage settings', 'Settings', 'Change platform configuration.')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  "group" = EXCLUDED."group",
  description = EXCLUDED.description,
  "updatedAt" = CURRENT_TIMESTAMP;

-- Preserve legacy administrator and moderator access as editable staff roles.
INSERT INTO "StaffRole" (id, name, slug, description, color, position)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'Administrator', 'administrator', 'Migrated administrator access.', '#0f766e', 80),
  ('10000000-0000-4000-8000-000000000002', 'Moderator', 'moderator', 'Migrated moderation access.', '#2563eb', 50)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "StaffUserRole" ("userId", "roleId")
SELECT "userId", '10000000-0000-4000-8000-000000000001'
FROM "_LegacyStaffTypes"
WHERE role IN ('SUPER_ADMIN', 'ADMIN')
ON CONFLICT DO NOTHING;

INSERT INTO "StaffUserRole" ("userId", "roleId")
SELECT "userId", '10000000-0000-4000-8000-000000000002'
FROM "_LegacyStaffTypes"
WHERE role = 'MODERATOR'
ON CONFLICT DO NOTHING;

INSERT INTO "StaffRolePermission" ("roleId", "permissionId")
SELECT '10000000-0000-4000-8000-000000000001', id FROM "StaffPermission"
ON CONFLICT DO NOTHING;

INSERT INTO "StaffRolePermission" ("roleId", "permissionId")
SELECT '10000000-0000-4000-8000-000000000002', id
FROM "StaffPermission"
WHERE key IN (
  'admin.overview.read',
  'admin.users.read',
  'admin.listings.read',
  'admin.listings.moderate',
  'admin.auctions.read',
  'admin.moderation.read',
  'admin.moderation.manage',
  'admin.agents.read',
  'admin.messages.read',
  'admin.media.private.read'
)
ON CONFLICT DO NOTHING;

DROP TABLE "_LegacyStaffTypes";
DROP TYPE "GlobalRole";

COMMIT;
