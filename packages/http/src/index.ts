import type { ZodType } from "zod";
import { apiErrorSchema } from "@real-estate/contracts";

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_ERROR_TEXT_LENGTH = 500;

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    public readonly requestId?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "HttpError";
  }
}

export type RequestOptions<T> = Omit<RequestInit, "body" | "signal"> & {
  body?: unknown;
  schema: ZodType<T>;
  baseUrl?: string;
  idempotencyKey?: string;
  signal?: AbortSignal | null | undefined;
  timeoutMs?: number;
};

function composeAbortSignal(
  signal: AbortSignal | null | undefined,
  timeoutMs: number,
): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}

async function readPayload(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) return null;

  const text = await response.text();
  if (!text) return null;

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("json")) return text;

  try {
    return JSON.parse(text) as unknown;
  } catch (cause) {
    throw new HttpError(
      502,
      "INVALID_JSON_RESPONSE",
      "The service returned an invalid JSON response.",
      undefined,
      response.headers.get("x-request-id") ?? undefined,
      { cause },
    );
  }
}

function isAbortLike(error: unknown): error is DOMException {
  return (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

export async function httpRequest<T>(
  path: string,
  options: RequestOptions<T>,
): Promise<T> {
  const {
    body,
    schema,
    baseUrl = "",
    idempotencyKey,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    headers: initialHeaders,
    signal,
    cache = "no-store",
    ...requestInit
  } = options;

  if (!path.startsWith("/")) {
    throw new Error("HTTP request paths must start with '/'.");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
    throw new Error(
      "HTTP timeout must be between 1,000 and 120,000 milliseconds.",
    );
  }

  const headers = new Headers(initialHeaders);
  headers.set("Accept", "application/json");
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);

  const init: RequestInit = {
    ...requestInit,
    cache,
    credentials: "include",
    headers,
    signal: composeAbortSignal(signal, timeoutMs),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, init);
  } catch (cause) {
    if (isAbortLike(cause)) {
      if (signal?.aborted) throw cause;
      throw new HttpError(
        408,
        "REQUEST_TIMEOUT",
        "The request timed out.",
        undefined,
        undefined,
        { cause },
      );
    }
    throw new HttpError(
      0,
      "NETWORK_ERROR",
      "The service could not be reached.",
      undefined,
      undefined,
      { cause },
    );
  }

  const payload = await readPayload(response);
  const responseRequestId = response.headers.get("x-request-id") ?? undefined;

  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(payload);
    if (parsed.success) {
      throw new HttpError(
        response.status,
        parsed.data.code,
        parsed.data.message,
        parsed.data.details,
        parsed.data.requestId ?? responseRequestId,
      );
    }

    throw new HttpError(
      response.status,
      "HTTP_ERROR",
      response.status >= 500
        ? "The service could not complete the request."
        : typeof payload === "string" &&
            payload.length <= MAX_ERROR_TEXT_LENGTH
          ? payload
          : response.statusText || "The request failed.",
      undefined,
      responseRequestId,
    );
  }

  return schema.parse(payload);
}

export function createApiBaseUrl(): string {
  if (typeof window !== "undefined") return "/api/v1";

  const internalUrl = process.env.API_INTERNAL_URL;
  if (!internalUrl && process.env.NODE_ENV === "production") {
    throw new Error("API_INTERNAL_URL is required for server-side production requests.");
  }

  return `${(internalUrl ?? "http://localhost:3001").replace(/\/$/, "")}/api/v1`;
}
