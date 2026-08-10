import { createApiBaseUrl, httpRequest } from "@real-estate/http";
import type { ZodType } from "zod";

export function apiRequest<T>(path: string, options: Omit<Parameters<typeof httpRequest<T>>[1], "baseUrl"> & { schema: ZodType<T> }) {
  return httpRequest(path, { ...options, baseUrl: createApiBaseUrl() });
}
