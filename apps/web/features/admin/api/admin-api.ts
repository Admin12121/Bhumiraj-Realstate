import {
  adminAgentsResponseSchema,
  adminOverviewSchema,
  adminAuditResponseSchema,
  adminAuctionsResponseSchema,
  adminListingsResponseSchema,
  adminMessagesResponseSchema,
  adminAccessSchema,
  adminUserDetailSchema,
  listingFeeSettingsSchema,
  adminUsersResponseSchema,
  staffMembersResponseSchema,
  staffCandidatesResponseSchema,
  staffRbacCatalogSchema,
  moderationQueueResponseSchema,
  platformSettingsSchema,
  platformInvitationsResponseSchema,
} from "@real-estate/contracts"
import { z } from "zod"
import { apiRequest } from "@/shared/http/api"

function queryString(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") params.set(key, String(value))
  }
  return params.toString()
}

export const getAdminOverview = (signal?: AbortSignal) =>
  apiRequest("/admin/overview", {
    method: "GET",
    schema: adminOverviewSchema,
    signal,
  })

export const getAdminUsers = (
  page: number,
  pageSize = 25,
  search = "",
  accountType = "",
  status = ""
) =>
  apiRequest(
    `/admin/users?${queryString({ page, pageSize, search, accountType, status })}`,
    { method: "GET", schema: adminUsersResponseSchema }
  )

export const getListingFeeSettings = () =>
  apiRequest("/admin/listing-fee", {
    method: "GET",
    schema: listingFeeSettingsSchema,
  })

export const updateListingFeeSettings = (
  body: z.infer<typeof listingFeeSettingsSchema>,
) =>
  apiRequest("/admin/listing-fee", {
    method: "PUT",
    body,
    schema: listingFeeSettingsSchema,
  })

export const getAdminUserDetail = (id: string) =>
  apiRequest(`/admin/users/${encodeURIComponent(id)}`, {
    method: "GET",
    schema: adminUserDetailSchema,
  })

export const setAdminUserAccountType = (
  id: string,
  accountType: "USER" | "AGENT"
) =>
  apiRequest(`/admin/users/${id}/account-type`, {
    method: "POST",
    body: { accountType },
    schema: z.object({
      id: z.string(),
      accountType: z.enum(["USER", "AGENT"]),
    }),
  })

export const getAdminAccess = () =>
  apiRequest("/admin/access", { method: "GET", schema: adminAccessSchema })

export const getStaffRbacCatalog = () =>
  apiRequest("/admin/roles", { method: "GET", schema: staffRbacCatalogSchema })

export const createStaffRole = (body: {
  name: string
  description: string | null
  color: string
  position: number
  permissionKeys: string[]
}) =>
  apiRequest("/admin/roles", {
    method: "POST",
    body,
    schema: z.object({ id: z.string() }),
  })

export const updateStaffRole = (
  id: string,
  body: {
    name: string
    description: string | null
    color: string
    position: number
  }
) =>
  apiRequest(`/admin/roles/${id}`, {
    method: "PATCH",
    body,
    schema: z.object({ id: z.string() }),
  })

export const setStaffRolePermissions = (id: string, permissionKeys: string[]) =>
  apiRequest(`/admin/roles/${id}/permissions`, {
    method: "PUT",
    body: { permissionKeys },
    schema: z.object({ id: z.string() }),
  })

export const deleteStaffRole = (id: string) =>
  apiRequest(`/admin/roles/${id}`, {
    method: "DELETE",
    schema: z.object({ id: z.string() }),
  })

export const getStaffMembers = (page: number, search = "", pageSize = 25) =>
  apiRequest(`/admin/staff?${queryString({ page, pageSize, search })}`, {
    method: "GET",
    schema: staffMembersResponseSchema,
  })

export const createStaffMember = (userId: string, roleIds: string[]) =>
  apiRequest("/admin/staff", {
    method: "POST",
    body: { userId, roleIds },
    schema: z.object({ id: z.string(), accountType: z.literal("STAFF") }),
  })

export const getStaffCandidates = (search: string) =>
  apiRequest(`/admin/staff-candidates?${queryString({ search })}`, {
    method: "GET",
    schema: staffCandidatesResponseSchema,
  })

export const assignStaffRole = (userId: string, roleId: string) =>
  apiRequest(`/admin/staff/${userId}/roles/${roleId}`, {
    method: "POST",
    schema: z.object({ userId: z.string(), roleId: z.string() }),
  })

export const removeStaffRole = (userId: string, roleId: string) =>
  apiRequest(`/admin/staff/${userId}/roles/${roleId}`, {
    method: "DELETE",
    schema: z.object({ userId: z.string(), roleId: z.string() }),
  })

export const setStaffMemberRoles = (userId: string, roleIds: string[]) =>
  apiRequest(`/admin/staff/${userId}/roles`, {
    method: "PUT",
    body: { roleIds },
    schema: z.object({ userId: z.string(), roleIds: z.array(z.string()) }),
  })

export const revokeStaffMember = (userId: string) =>
  apiRequest(`/admin/staff/${userId}`, {
    method: "DELETE",
    schema: z.object({ id: z.string(), accountType: z.literal("USER") }),
  })

export const setStaffMemberStatus = (
  userId: string,
  status: "ACTIVE" | "SUSPENDED",
  reason?: string | null
) =>
  apiRequest(`/admin/staff/${userId}/status`, {
    method: "PATCH",
    body: { status, reason },
    schema: z.object({
      userId: z.string(),
      status: z.enum(["ACTIVE", "SUSPENDED"]),
    }),
  })

export const getStaffInvitations = (page = 1) =>
  apiRequest(
    `/admin/staff-invitations?${queryString({ page, pageSize: 25 })}`,
    {
      method: "GET",
      schema: platformInvitationsResponseSchema,
    }
  )

export const createStaffInvitation = (email: string, roleIds: string[]) =>
  apiRequest("/admin/staff-invitations", {
    method: "POST",
    body: { email, type: "STAFF", roleIds },
    schema: z.object({
      id: z.string(),
      inviteLink: z.string().url(),
      delivery: z.enum(["SENT", "NOT_CONFIGURED", "FAILED"]),
      expiresAt: z.string(),
    }),
  })

export const revokeStaffInvitation = (id: string) =>
  apiRequest(`/admin/staff-invitations/${id}`, {
    method: "DELETE",
    schema: z.object({ id: z.string(), status: z.literal("REVOKED") }),
  })

export const transferOwnership = (
  targetUserId: string,
  previousOwnerRoleIds: string[]
) =>
  apiRequest("/admin/owner/transfer", {
    method: "POST",
    body: {
      targetUserId,
      previousOwnerRoleIds,
      confirmation: "TRANSFER OWNERSHIP",
    },
    schema: z.object({
      ownerId: z.string(),
      previousOwnerId: z.string(),
      requiresSignIn: z.boolean(),
    }),
  })

export const banAdminUser = (id: string, reason: string) =>
  apiRequest(`/admin/users/${id}/ban`, {
    method: "POST",
    body: { reason },
    schema: z.object({ id: z.string(), banned: z.boolean() }),
  })

export const unbanAdminUser = (id: string) =>
  apiRequest(`/admin/users/${id}/unban`, {
    method: "POST",
    schema: z.object({ id: z.string(), banned: z.boolean() }),
  })

export const getAdminListings = (
  page: number,
  pageSize = 25,
  status = "",
  search = ""
) =>
  apiRequest(
    `/admin/listings?${queryString({ page, pageSize, status, search })}`,
    { method: "GET", schema: adminListingsResponseSchema }
  )

export const decideAdminListing = (
  id: string,
  decision: "PUBLISH" | "REJECT",
  reason?: string
) =>
  apiRequest(`/admin/listings/${id}/decision`, {
    method: "POST",
    body: { decision, reason },
    schema: z.object({ id: z.string(), status: z.string() }),
  })

export const getAdminAuctions = (
  page: number,
  pageSize = 25,
  status = "",
  search = ""
) =>
  apiRequest(
    `/admin/auctions?${queryString({ page, pageSize, status, search })}`,
    { method: "GET", schema: adminAuctionsResponseSchema }
  )

export const actOnAdminAuction = (
  id: string,
  action: "PAUSE" | "RESUME" | "CANCEL",
  reason?: string
) =>
  apiRequest(`/admin/auctions/${id}/action`, {
    method: "POST",
    body: { action, reason },
    schema: z.object({ id: z.string(), status: z.string() }),
  })

export const getModerationQueue = (
  page: number,
  kind: "LISTING_REPORT" | "USER_REPORT",
  status = "OPEN",
  search = ""
) =>
  apiRequest(
    `/admin/moderation?${queryString({ page, pageSize: 25, kind, status, search })}`,
    { method: "GET", schema: moderationQueueResponseSchema }
  )

export const decideModerationReport = (
  kind: "LISTING_REPORT" | "USER_REPORT",
  id: string,
  status: "IN_REVIEW" | "RESOLVED" | "DISMISSED",
  reason: string
) =>
  apiRequest(
    `/admin/moderation/${kind === "LISTING_REPORT" ? "listing" : "user"}/${id}`,
    {
      method: "PATCH",
      body: { status, reason },
      schema: z.object({ id: z.string(), status: z.string() }),
    }
  )

export const getAdminAgents = (page: number, search = "") =>
  apiRequest(`/admin/agents?${queryString({ page, pageSize: 25, search })}`, {
    method: "GET",
    schema: adminAgentsResponseSchema,
  })

export const getAgentCandidates = (search: string) =>
  apiRequest(`/admin/agents/candidates?${queryString({ search })}`, {
    method: "GET",
    schema: staffCandidatesResponseSchema,
  })

export const createAgent = (userId: string) =>
  apiRequest("/admin/agents", {
    method: "POST",
    body: { userId },
    schema: z.object({
      id: z.string(),
      userId: z.string(),
      status: z.literal("PENDING"),
    }),
  })

export const setAgentStatus = (
  id: string,
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "RETIRED",
  reason?: string | null
) =>
  apiRequest(`/admin/agents/${id}/status`, {
    method: "PATCH",
    body: { status, reason },
    schema: z.object({
      id: z.string(),
      status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "RETIRED"]),
    }),
  })

export const setAgentAvailability = (
  id: string,
  availabilityStatus: "AVAILABLE" | "UNAVAILABLE" | "AT_CAPACITY",
  maxActiveCases: number
) =>
  apiRequest(`/admin/agents/${id}/availability`, {
    method: "PATCH",
    body: { availabilityStatus, maxActiveCases },
    schema: z.object({
      id: z.string(),
      availabilityStatus: z.enum(["AVAILABLE", "UNAVAILABLE", "AT_CAPACITY"]),
      maxActiveCases: z.number(),
    }),
  })

export const getAgentInvitations = (page = 1) =>
  apiRequest(
    `/admin/agent-invitations?${queryString({ page, pageSize: 25 })}`,
    {
      method: "GET",
      schema: platformInvitationsResponseSchema,
    }
  )

export const createAgentInvitation = (email: string) =>
  apiRequest("/admin/agent-invitations", {
    method: "POST",
    body: { email, type: "AGENT", roleIds: [] },
    schema: z.object({
      id: z.string(),
      inviteLink: z.string().url(),
      delivery: z.enum(["SENT", "NOT_CONFIGURED", "FAILED"]),
      expiresAt: z.string(),
    }),
  })

export const revokeAgentInvitation = (id: string) =>
  apiRequest(`/admin/agent-invitations/${id}`, {
    method: "DELETE",
    schema: z.object({ id: z.string(), status: z.literal("REVOKED") }),
  })

export const getAdminAudit = (
  page: number,
  search = "",
  action = "",
  entityType = "",
  direction: "asc" | "desc" = "desc",
) =>
  apiRequest(
    `/admin/audit?${queryString({ page, pageSize: 25, search, action, entityType, direction })}`,
    { method: "GET", schema: adminAuditResponseSchema },
  )

export const getAdminMessages = (page: number, search = "") =>
  apiRequest(`/admin/messages?${queryString({ page, pageSize: 25, search })}`, {
    method: "GET",
    schema: adminMessagesResponseSchema,
  })

export const getPlatformSettings = () =>
  apiRequest("/admin/settings", {
    method: "GET",
    schema: platformSettingsSchema,
  })

export const updatePlatformSettings = (
  body: z.infer<typeof platformSettingsSchema>
) =>
  apiRequest("/admin/settings", {
    method: "PATCH",
    body,
    schema: platformSettingsSchema,
  })
