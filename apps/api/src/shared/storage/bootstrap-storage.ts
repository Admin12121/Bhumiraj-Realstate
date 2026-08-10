import { ensureStorageBuckets } from "@real-estate/storage";
import { apiEnv } from "../../bootstrap-env";

export async function bootstrapStorage(): Promise<void> {
  if (!apiEnv.S3_AUTO_SETUP) return;

  const warnings = await ensureStorageBuckets({
    ...(apiEnv.S3_ENDPOINT ? { endpoint: apiEnv.S3_ENDPOINT } : {}),
    ...(apiEnv.S3_PUBLIC_ENDPOINT
      ? { publicEndpoint: apiEnv.S3_PUBLIC_ENDPOINT }
      : {}),
    region: apiEnv.S3_REGION,
    accessKeyId: apiEnv.S3_ACCESS_KEY_ID,
    secretAccessKey: apiEnv.S3_SECRET_ACCESS_KEY,
    forcePathStyle: apiEnv.S3_FORCE_PATH_STYLE,
    publicBucket: apiEnv.S3_PUBLIC_BUCKET,
    privateBucket: apiEnv.S3_PRIVATE_BUCKET,
    allowedOrigin: apiEnv.APP_URL,
    configureBucketCors: apiEnv.S3_CONFIGURE_BUCKET_CORS,
  });

  for (const warning of warnings) {
    console.warn(`Storage bootstrap warning: ${warning}`);
  }
}
