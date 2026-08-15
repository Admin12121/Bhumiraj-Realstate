import {
  accountOverviewSchema,
  accountSessionSchema,
  updateProfileSchema,
  userProfileSchema,
} from "@real-estate/contracts"
import { z } from "zod"
import { apiRequest } from "@/shared/http/api"

export const getAccount = () =>
  apiRequest("/account", { method: "GET", schema: accountOverviewSchema })

export const getMyProfile = () =>
  apiRequest("/profiles/me", { method: "GET", schema: userProfileSchema })

export const updateMyProfile = (body: z.infer<typeof updateProfileSchema>) =>
  apiRequest("/profiles/me", {
    method: "PATCH",
    body,
    schema: userProfileSchema,
  })

export const getSessions = () =>
  apiRequest("/account/sessions", {
    method: "GET",
    schema: z.array(accountSessionSchema),
  })

export const revokeSession = (sessionId: string) =>
  apiRequest(`/account/sessions/${sessionId}`, {
    method: "DELETE",
    schema: z.object({ revoked: z.boolean() }),
  })

export const acceptPlatformInvitation = (token: string) =>
  apiRequest("/invitations/accept", {
    method: "POST",
    body: { token },
    schema: z.object({
      id: z.string(),
      accountType: z.enum(["STAFF", "AGENT"]),
      requiresSignIn: z.boolean(),
    }),
  })

export const requestDeletion = () =>
  apiRequest("/account/deletion", {
    method: "POST",
    body: { confirmation: "DELETE MY ACCOUNT" },
    schema: z.object({
      lifecycleStatus: z.literal("PENDING_DELETION"),
      requestedAt: z.iso.datetime({ offset: true }),
      scheduledFor: z.iso.datetime({ offset: true }),
    }),
  })

export const cancelDeletion = () =>
  apiRequest("/account/deletion/cancel", {
    method: "POST",
    body: { confirmation: "KEEP MY ACCOUNT" },
    schema: z.object({ lifecycleStatus: z.literal("ACTIVE") }),
  })
