import { defineStaffPermissions } from '../../shared/auth/staff-permission.registry';

export const ADMIN_PERMISSIONS = defineStaffPermissions({
  OVERVIEW_READ: {
    key: 'admin.overview.read',
    label: 'View dashboard',
    group: 'Overview',
    description: 'View administration metrics and recent activity.',
  },
  USERS_READ: {
    key: 'admin.users.read',
    label: 'View users',
    group: 'Users',
    description: 'Search and inspect customer accounts.',
  },
  USERS_STATUS_MANAGE: {
    key: 'admin.users.status.manage',
    label: 'Manage user status',
    group: 'Users',
    description: 'Suspend and restore customer accounts.',
  },
  USERS_TYPE_MANAGE: {
    key: 'admin.users.type.manage',
    label: 'Manage account types',
    group: 'Users',
    description:
      'Create or revoke agent accounts. Staff and owner governance remain separately protected.',
  },
  STAFF_READ: {
    key: 'admin.staff.read',
    label: 'View staff',
    group: 'Staff',
    description: 'View staff members and their assigned roles.',
  },
  STAFF_MANAGE: {
    key: 'admin.staff.manage',
    label: 'Manage staff',
    group: 'Staff',
    description: 'Create staff and assign roles below the actor hierarchy.',
  },
  ROLES_READ: {
    key: 'admin.roles.read',
    label: 'View staff roles',
    group: 'Staff roles',
    description: 'View staff roles and registered permissions.',
  },
  ROLES_MANAGE: {
    key: 'admin.roles.manage',
    label: 'Manage staff roles',
    group: 'Staff roles',
    description: 'Create and edit roles below the actor hierarchy.',
  },
  LISTINGS_READ: {
    key: 'admin.listings.read',
    label: 'View listings',
    group: 'Listings',
    description: 'View the administration listing queue.',
  },
  LISTINGS_MODERATE: {
    key: 'admin.listings.moderate',
    label: 'Moderate listings',
    group: 'Listings',
    description: 'Publish or reject submitted listings.',
  },
  PAYMENTS_READ: {
    key: 'admin.payments.read',
    label: 'View listing payments',
    group: 'Listings',
    description: 'View submitted listing-fee payment proofs.',
  },
  PAYMENTS_REVIEW: {
    key: 'admin.payments.review',
    label: 'Verify listing payments',
    group: 'Listings',
    description: 'Approve or reject listing-fee payment proofs.',
  },
  ASSIGNMENTS_MANAGE: {
    key: 'admin.assignments.manage',
    label: 'Assign listings to agents',
    group: 'Listings',
    description: 'Offer verified listings to agents and revoke offers.',
  },
  SUPPORT_READ: {
    key: 'admin.support.read',
    label: 'View support chats',
    group: 'Support',
    description: 'View general enquiry conversations from the website.',
  },
  SUPPORT_REPLY: {
    key: 'admin.support.reply',
    label: 'Reply to support chats',
    group: 'Support',
    description: 'Reply to, assign and close support conversations.',
  },
  AUCTIONS_READ: {
    key: 'admin.auctions.read',
    label: 'View auctions',
    group: 'Auctions',
    description: 'View auction operations and status.',
  },
  AUCTIONS_MANAGE: {
    key: 'admin.auctions.manage',
    label: 'Manage auctions',
    group: 'Auctions',
    description: 'Pause, resume, or cancel auctions.',
  },
  MODERATION_READ: {
    key: 'admin.moderation.read',
    label: 'View reports',
    group: 'Moderation',
    description: 'View user and listing reports.',
  },
  MODERATION_MANAGE: {
    key: 'admin.moderation.manage',
    label: 'Resolve reports',
    group: 'Moderation',
    description: 'Review and resolve user and listing reports.',
  },
  AGENTS_READ: {
    key: 'admin.agents.read',
    label: 'View agents',
    group: 'Agents',
    description: 'View platform agent profiles.',
  },
  AGENTS_MANAGE: {
    key: 'admin.agents.manage',
    label: 'Manage agents',
    group: 'Agents',
    description: 'Create, verify, suspend, or retire platform agents.',
  },
  MESSAGES_READ: {
    key: 'admin.messages.read',
    label: 'View support messages',
    group: 'Messages',
    description: 'View platform support conversations.',
  },
  AUDIT_READ: {
    key: 'admin.audit.read',
    label: 'View audit log',
    group: 'Security',
    description: 'View immutable administrative audit events.',
  },
  PRIVATE_MEDIA_READ: {
    key: 'admin.media.private.read',
    label: 'View private media',
    group: 'Security',
    description: 'Access private media for authorized review.',
  },
  SETTINGS_READ: {
    key: 'admin.settings.read',
    label: 'View settings',
    group: 'Settings',
    description: 'View platform configuration.',
  },
  SETTINGS_MANAGE: {
    key: 'admin.settings.manage',
    label: 'Manage settings',
    group: 'Settings',
    description: 'Change platform configuration.',
  },
} as const);

export type AdminPermission =
  (typeof ADMIN_PERMISSIONS)[keyof typeof ADMIN_PERMISSIONS];
