import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutBucketLifecycleConfigurationCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type StorageConfig = {
  endpoint?: string;
  publicEndpoint?: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

export function createStorage(config: StorageConfig) {
  const common = {
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    requestChecksumCalculation: "WHEN_REQUIRED" as const,
    responseChecksumValidation: "WHEN_REQUIRED" as const,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  };

  const clientOptions =
    config.endpoint === undefined
      ? common
      : { ...common, endpoint: config.endpoint };
  const signingEndpoint = config.publicEndpoint ?? config.endpoint;
  const signingClientOptions =
    signingEndpoint === undefined
      ? common
      : { ...common, endpoint: signingEndpoint };

  const client = new S3Client(clientOptions);
  const signingClient = new S3Client({
    ...signingClientOptions,
  });

  return {
    createUploadUrl: (
      bucket: string,
      key: string,
      contentType: string,
      expiresIn = 600,
    ) =>
      getSignedUrl(
        signingClient,
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          ContentType: contentType,
        }),
        { expiresIn },
      ),
    createDownloadUrl: (
      bucket: string,
      key: string,
      expiresIn = 300,
    ) =>
      getSignedUrl(
        signingClient,
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        { expiresIn },
      ),
    head: (bucket: string, key: string) =>
      client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })),
    client,
  };
}

export type EnsureStorageBucketsInput = StorageConfig & {
  publicBucket: string;
  privateBucket: string;
  allowedOrigin: string;
  configureBucketCors?: boolean | undefined;
};

function isAlreadyExistsError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error.name === "BucketAlreadyOwnedByYou" ||
      error.name === "BucketAlreadyExists")
  );
}

export async function ensureStorageBuckets(
  input: EnsureStorageBucketsInput,
): Promise<string[]> {
  const storage = createStorage(input);
  const warnings: string[] = [];

  for (const bucket of [input.publicBucket, input.privateBucket]) {
    try {
      await storage.client.send(new CreateBucketCommand({ Bucket: bucket }));
    } catch (error) {
      if (!isAlreadyExistsError(error)) throw error;
    }
  }

  try {
    await storage.client.send(
      new PutBucketPolicyCommand({
        Bucket: input.publicBucket,
        Policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: "*",
              Action: ["s3:GetObject"],
              Resource: [`arn:aws:s3:::${input.publicBucket}/*`],
            },
          ],
        }),
      }),
    );
  } catch (error) {
    warnings.push(
      `Unable to apply public bucket policy: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (input.configureBucketCors) {
    for (const bucket of [input.publicBucket, input.privateBucket]) {
      try {
        await storage.client.send(
          new PutBucketCorsCommand({
            Bucket: bucket,
            CORSConfiguration: {
              CORSRules: [
                {
                  AllowedOrigins: [input.allowedOrigin],
                  AllowedMethods: ["GET", "HEAD", "PUT"],
                  AllowedHeaders: ["*"],
                  ExposeHeaders: ["ETag"],
                  MaxAgeSeconds: 3600,
                },
              ],
            },
          }),
        );
      } catch (error) {
        warnings.push(
          `Unable to apply CORS for ${bucket}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  try {
    await storage.client.send(
      new PutBucketLifecycleConfigurationCommand({
        Bucket: input.privateBucket,
        LifecycleConfiguration: {
          Rules: [
            {
              ID: "expire-incomplete-uploads",
              Status: "Enabled",
              Filter: { Prefix: "uploads/" },
              Expiration: { Days: 1 },
            },
          ],
        },
      }),
    );
  } catch (error) {
    warnings.push(
      `Unable to apply private upload lifecycle: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return warnings;
}
