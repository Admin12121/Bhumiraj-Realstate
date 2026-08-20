import { z } from "zod";
import { notificationPageSchema } from "@real-estate/contracts";

import { apiRequest } from "@/shared/http/api";

const okSchema = z.unknown();

export const getNotifications = (unreadOnly = false, limit = 20) =>
  apiRequest(
    `/notifications?unreadOnly=${unreadOnly ? "true" : "false"}&limit=${limit}`,
    { method: "GET", schema: notificationPageSchema },
  );

export const markNotificationRead = (id: string) =>
  apiRequest(`/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
    schema: okSchema,
  });

export const markAllNotificationsRead = () =>
  apiRequest("/notifications/read-all", { method: "PATCH", schema: okSchema });
