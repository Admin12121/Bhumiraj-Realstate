import {
  adminAgentsResponseSchema,
  adminOverviewSchema,
  adminAuditResponseSchema,
  adminAuctionsResponseSchema,
  adminListingsResponseSchema,
  adminMessagesResponseSchema,
  adminUsersResponseSchema,
  moderationQueueResponseSchema,
  platformSettingsSchema,
} from "@real-estate/contracts";
import { z } from "zod";
import { apiRequest } from "@/shared/http/api";

function queryString(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params.toString();
}


export const getAdminOverview = (signal?: AbortSignal) =>
  apiRequest("/admin/overview", {
    method: "GET",
    schema: adminOverviewSchema,
    signal,
  });

export const getAdminUsers = (
  page: number,
  pageSize = 25,
  search = "",
  role = "",
  status = "",
) =>
  apiRequest(
    `/admin/users?${queryString({ page, pageSize, search, role, status })}`,
    { method: "GET", schema: adminUsersResponseSchema },
  );

export const setAdminUserRole = (id: string, role: string) =>
  apiRequest(`/admin/users/${id}/role`, {
    method: "POST",
    body: { role },
    schema: z.object({ id: z.string(), role: z.string() }),
  });

export const banAdminUser = (id: string, reason: string) =>
  apiRequest(`/admin/users/${id}/ban`, {
    method: "POST",
    body: { reason },
    schema: z.object({ id: z.string(), banned: z.boolean() }),
  });

export const unbanAdminUser = (id: string) =>
  apiRequest(`/admin/users/${id}/unban`, {
    method: "POST",
    schema: z.object({ id: z.string(), banned: z.boolean() }),
  });

export const getAdminListings = (
  page: number,
  pageSize = 25,
  status = "",
  search = "",
) =>
  apiRequest(
    `/admin/listings?${queryString({ page, pageSize, status, search })}`,
    { method: "GET", schema: adminListingsResponseSchema },
  );

export const decideAdminListing = (
  id: string,
  decision: "PUBLISH" | "REJECT",
  reason?: string,
) =>
  apiRequest(`/admin/listings/${id}/decision`, {
    method: "POST",
    body: { decision, reason },
    schema: z.object({ id: z.string(), status: z.string() }),
  });

export const getAdminAuctions = (
  page: number,
  pageSize = 25,
  status = "",
  search = "",
) =>
  apiRequest(
    `/admin/auctions?${queryString({ page, pageSize, status, search })}`,
    { method: "GET", schema: adminAuctionsResponseSchema },
  );

export const actOnAdminAuction = (
  id: string,
  action: "PAUSE" | "RESUME" | "CANCEL",
  reason?: string,
) =>
  apiRequest(`/admin/auctions/${id}/action`, {
    method: "POST",
    body: { action, reason },
    schema: z.object({ id: z.string(), status: z.string() }),
  });

export const getModerationQueue = (
  page: number,
  kind: "LISTING_REPORT" | "USER_REPORT",
  status = "OPEN",
  search = "",
) =>
  apiRequest(
    `/admin/moderation?${queryString({ page, pageSize: 25, kind, status, search })}`,
    { method: "GET", schema: moderationQueueResponseSchema },
  );

export const decideModerationReport = (
  kind: "LISTING_REPORT" | "USER_REPORT",
  id: string,
  status: "IN_REVIEW" | "RESOLVED" | "DISMISSED",
  reason: string,
) =>
  apiRequest(
    `/admin/moderation/${kind === "LISTING_REPORT" ? "listing" : "user"}/${id}`,
    {
      method: "PATCH",
      body: { status, reason },
      schema: z.object({ id: z.string(), status: z.string() }),
    },
  );

export const getAdminAgents = (page: number, search = "") =>
  apiRequest(
    `/admin/agents?${queryString({ page, pageSize: 25, search })}`,
    { method: "GET", schema: adminAgentsResponseSchema },
  );

export const getAdminAudit = (page: number, search = "") =>
  apiRequest(
    `/admin/audit?${queryString({ page, pageSize: 25, search })}`,
    { method: "GET", schema: adminAuditResponseSchema },
  );

export const getAdminMessages = (page: number, search = "") =>
  apiRequest(
    `/admin/messages?${queryString({ page, pageSize: 25, search })}`,
    { method: "GET", schema: adminMessagesResponseSchema },
  );

export const getPlatformSettings = () =>
  apiRequest("/admin/settings", {
    method: "GET",
    schema: platformSettingsSchema,
  });

export const updatePlatformSettings = (
  body: z.infer<typeof platformSettingsSchema>,
) =>
  apiRequest("/admin/settings", {
    method: "PATCH",
    body,
    schema: platformSettingsSchema,
  });
