import { z } from "zod";

const booleanFromEnv = z.preprocess((value) => {
  if (value === undefined || typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return value;
}, z.boolean().optional().default(false));

const optionalCredential = z.preprocess((value) => {
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}, z.string().trim().min(1).optional());

export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_NAME: z.string().trim().min(1).max(100).default("Bhumiraj Estates"),
    APP_URL: z.url(),
    API_INTERNAL_URL: z.url().optional(),
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    DATABASE_URL: z.string().min(1),
    DIRECT_URL: z.string().min(1).optional(),
    DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(15),
    DB_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(500).max(60_000).default(5_000),
    DB_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(300_000).default(30_000),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    PASSKEY_RP_ID: z.string().trim().min(1).optional(),
    GOOGLE_CLIENT_ID: optionalCredential,
    GOOGLE_CLIENT_SECRET: optionalCredential,
    GITHUB_CLIENT_ID: optionalCredential,
    GITHUB_CLIENT_SECRET: optionalCredential,
    REDIS_CACHE_URL: z.string().min(1),
    REDIS_CRITICAL_URL: z.string().min(1),
    S3_ENDPOINT: z.url().optional(),
    S3_PUBLIC_ENDPOINT: z.url().optional(),
    S3_REGION: z.string().trim().min(1).default("us-east-1"),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
    S3_PUBLIC_BUCKET: z.string().min(1),
    S3_PRIVATE_BUCKET: z.string().min(1),
    S3_FORCE_PATH_STYLE: booleanFromEnv,
    S3_AUTO_SETUP: booleanFromEnv,
    S3_CONFIGURE_BUCKET_CORS: booleanFromEnv,
    CDN_BASE_URL: z.url(),
    MAIL_FROM: z.string().min(3),
    RESEND_API_KEY: optionalCredential,
    ACCOUNT_DELETION_GRACE_DAYS: z.coerce.number().int().min(1).max(365).default(14),
    E2E_MODE: booleanFromEnv,
    E2E_SETUP_KEY: z.string().min(16).optional(),
    VIEW_HASH_SECRET: z.string().min(32),
    CLAMAV_HOST: z.string().min(1).optional(),
    CLAMAV_PORT: z.coerce.number().int().min(1).max(65_535).default(3310),
    CLAMAV_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(15_000),
    HTTP_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(20_000),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(1),
  })
  .superRefine((env, context) => {
    const credentialPairs = [
      ["GOOGLE_CLIENT_ID", env.GOOGLE_CLIENT_ID, "GOOGLE_CLIENT_SECRET", env.GOOGLE_CLIENT_SECRET],
      ["GITHUB_CLIENT_ID", env.GITHUB_CLIENT_ID, "GITHUB_CLIENT_SECRET", env.GITHUB_CLIENT_SECRET],
    ] as const;

    for (const [firstName, first, secondName, second] of credentialPairs) {
      if (Boolean(first) !== Boolean(second)) {
        context.addIssue({
          code: "custom",
          path: [first ? secondName : firstName],
          message: `${firstName} and ${secondName} must be configured together.`,
        });
      }
    }

    if (env.E2E_MODE && !env.E2E_SETUP_KEY) {
      context.addIssue({
        code: "custom",
        path: ["E2E_SETUP_KEY"],
        message: "E2E_SETUP_KEY is required when E2E_MODE is enabled.",
      });
    }

    const appUrl = new URL(env.APP_URL);
    const authUrl = new URL(env.BETTER_AUTH_URL);
    if (authUrl.origin !== appUrl.origin || !authUrl.pathname.startsWith("/api/auth")) {
      context.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_URL"],
        message: "BETTER_AUTH_URL must use the application origin and /api/auth path.",
      });
    }
    if (env.PASSKEY_RP_ID && env.PASSKEY_RP_ID !== appUrl.hostname) {
      context.addIssue({
        code: "custom",
        path: ["PASSKEY_RP_ID"],
        message: "PASSKEY_RP_ID must match the public application hostname.",
      });
    }

    if (env.NODE_ENV === "production") {
      for (const [name, value] of [
        ["APP_URL", env.APP_URL],
        ["BETTER_AUTH_URL", env.BETTER_AUTH_URL],
        ["CDN_BASE_URL", env.CDN_BASE_URL],
      ] as const) {
        if (!value.startsWith("https://")) {
          context.addIssue({
            code: "custom",
            path: [name],
            message: `${name} must use HTTPS in production.`,
          });
        }
      }
      if (env.S3_PUBLIC_ENDPOINT && !env.S3_PUBLIC_ENDPOINT.startsWith("https://")) {
        context.addIssue({
          code: "custom",
          path: ["S3_PUBLIC_ENDPOINT"],
          message: "S3_PUBLIC_ENDPOINT must use HTTPS in production.",
        });
      }
      if (env.E2E_MODE) {
        context.addIssue({
          code: "custom",
          path: ["E2E_MODE"],
          message: "E2E_MODE must never be enabled in production.",
        });
      }
      if (!env.CLAMAV_HOST) {
        context.addIssue({
          code: "custom",
          path: ["CLAMAV_HOST"],
          message: "CLAMAV_HOST is required in production.",
        });
      }
      if (!env.RESEND_API_KEY) {
        context.addIssue({
          code: "custom",
          path: ["RESEND_API_KEY"],
          message: "RESEND_API_KEY is required in production.",
        });
      }
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function loadServerEnv(
  input: Record<string, string | undefined> = globalThis.process.env,
): ServerEnv {
  return serverEnvSchema.parse(input);
}
