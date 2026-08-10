-- Generated baseline for Bhumiraj Estates.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TYPE "GlobalRole" AS ENUM ('USER', 'AGENT', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN');
CREATE TYPE "UserLifecycleStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING_DELETION', 'DELETED');
CREATE TYPE "AgencyRole" AS ENUM ('OWNER', 'MANAGER', 'AGENT', 'VIEWER');
CREATE TYPE "VerificationStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');
CREATE TYPE "PropertyType" AS ENUM ('HOUSE', 'APARTMENT', 'LAND', 'COMMERCIAL', 'OFFICE', 'WAREHOUSE');
CREATE TYPE "ListingType" AS ENUM ('SALE', 'RENT', 'AUCTION');
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'WITHDRAWN', 'ARCHIVED');
CREATE TYPE "Furnishing" AS ENUM ('UNFURNISHED', 'SEMI_FURNISHED', 'FURNISHED');
CREATE TYPE "LocationPrecision" AS ENUM ('EXACT', 'APPROXIMATE', 'LOCALITY');
CREATE TYPE "MediaPurpose" AS ENUM ('LISTING_IMAGE', 'PROFILE_IMAGE', 'COVER_IMAGE', 'OWNERSHIP_DOCUMENT', 'KYC_DOCUMENT', 'AGENT_LICENSE', 'AGENCY_LOGO', 'MESSAGE_ATTACHMENT');
CREATE TYPE "MediaStatus" AS ENUM ('UPLOADING', 'UPLOADED', 'PROCESSING', 'READY', 'REJECTED', 'DELETED');
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'PRIVATE');
CREATE TYPE "InquiryStatus" AS ENUM ('OPEN', 'CONTACTED', 'QUALIFIED', 'CLOSED', 'SPAM');
CREATE TYPE "ViewingStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
CREATE TYPE "ConversationType" AS ENUM ('LISTING', 'DIRECT', 'SUPPORT');
CREATE TYPE "AuctionStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'LIVE', 'PAUSED', 'ENDED', 'AWAITING_SETTLEMENT', 'SETTLED', 'CANCELLED', 'VOIDED');
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'ELIGIBLE', 'REJECTED', 'WITHDRAWN');
CREATE TYPE "DepositStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'RELEASED', 'REFUNDED', 'FAILED');
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED');
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH', 'SMS');
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');
CREATE TYPE "ModerationStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');
CREATE TYPE "AuditAction" AS ENUM ('USER_CREATED', 'USER_UPDATED', 'USER_ROLE_CHANGED', 'USER_BANNED', 'USER_UNBANNED', 'USER_DELETION_REQUESTED', 'USER_DELETED', 'LISTING_CREATED', 'LISTING_SUBMITTED', 'LISTING_PUBLISHED', 'LISTING_REJECTED', 'LISTING_WITHDRAWN', 'AUCTION_CREATED', 'AUCTION_STARTED', 'AUCTION_PAUSED', 'AUCTION_RESUMED', 'AUCTION_ENDED', 'AUCTION_CANCELLED', 'BID_ACCEPTED', 'ADMIN_IMPERSONATION_STARTED', 'ADMIN_IMPERSONATION_ENDED', 'MEDIA_REJECTED');

CREATE TABLE "User" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "emailVerified" BOOLEAN DEFAULT FALSE NOT NULL,
  "image" TEXT,
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "role" TEXT DEFAULT 'USER' NOT NULL,
  "banned" BOOLEAN DEFAULT FALSE NOT NULL,
  "banReason" TEXT,
  "banExpires" TIMESTAMPTZ(3),
  "twoFactorEnabled" BOOLEAN DEFAULT FALSE NOT NULL,
  "lifecycleStatus" "UserLifecycleStatus" DEFAULT 'ACTIVE' NOT NULL,
  "deletionRequestedAt" TIMESTAMPTZ(3),
  "anonymizedAt" TIMESTAMPTZ(3),
  PRIMARY KEY ("id"),
  UNIQUE ("email")
);

CREATE TABLE "Session" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "token" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL,
  "impersonatedBy" TEXT,
  PRIMARY KEY ("id"),
  UNIQUE ("token")
);

CREATE TABLE "Account" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMPTZ(3),
  "refreshTokenExpiresAt" TIMESTAMPTZ(3),
  "scope" TEXT,
  "password" TEXT,
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("providerId", "accountId")
);

CREATE TABLE "Verification" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "Passkey" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "name" TEXT,
  "publicKey" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "credentialID" TEXT NOT NULL,
  "counter" INTEGER NOT NULL,
  "deviceType" TEXT NOT NULL,
  "backedUp" BOOLEAN NOT NULL,
  "transports" TEXT,
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "aaguid" TEXT,
  PRIMARY KEY ("id"),
  UNIQUE ("credentialID")
);

CREATE TABLE "TwoFactor" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "secret" TEXT NOT NULL,
  "backupCodes" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "UserProfile" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "userId" TEXT NOT NULL,
  "username" TEXT,
  "bio" VARCHAR(500),
  "phone" TEXT,
  "phoneVerifiedAt" TIMESTAMPTZ(3),
  "coverImageUrl" TEXT,
  "locale" TEXT DEFAULT 'en' NOT NULL,
  "timezone" TEXT DEFAULT 'Asia/Kathmandu' NOT NULL,
  "lastSeenAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("userId"),
  UNIQUE ("username"),
  UNIQUE ("phone")
);

CREATE TABLE "IdentityVerification" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "VerificationStatus" DEFAULT 'NOT_STARTED' NOT NULL,
  "provider" TEXT,
  "providerReference" TEXT,
  "reviewedById" TEXT,
  "reason" TEXT,
  "submittedAt" TIMESTAMPTZ(3),
  "verifiedAt" TIMESTAMPTZ(3),
  "expiresAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("userId")
);

CREATE TABLE "Agency" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "logoUrl" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "verifiedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("slug")
);

CREATE TABLE "AgencyMember" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "agencyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "AgencyRole" DEFAULT 'AGENT' NOT NULL,
  "joinedAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("agencyId", "userId")
);

CREATE TABLE "AgentProfile" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "userId" TEXT NOT NULL,
  "licenseNumber" TEXT,
  "headline" TEXT,
  "about" TEXT,
  "verifiedAt" TIMESTAMPTZ(3),
  "averageRating" DECIMAL(3,2) DEFAULT 0 NOT NULL,
  "reviewCount" INTEGER DEFAULT 0 NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("userId"),
  UNIQUE ("licenseNumber")
);

CREATE TABLE "AgentReview" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "agentProfileId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" VARCHAR(1000),
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("agentProfileId", "authorId")
);

CREATE TABLE "AdministrativeArea" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "parentId" TEXT,
  "level" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "code" TEXT,
  PRIMARY KEY ("id"),
  UNIQUE ("parentId", "slug")
);

CREATE TABLE "Address" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "areaId" TEXT,
  "province" TEXT NOT NULL,
  "district" TEXT NOT NULL,
  "municipality" TEXT NOT NULL,
  "ward" TEXT,
  "locality" TEXT NOT NULL,
  "street" TEXT,
  "postalCode" TEXT,
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "publicLatitude" DECIMAL(9,6),
  "publicLongitude" DECIMAL(9,6),
  "precision" "LocationPrecision" DEFAULT 'APPROXIMATE' NOT NULL,
  "location" geography(Point,4326) GENERATED ALWAYS AS (CASE WHEN "longitude" IS NULL OR "latitude" IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint("longitude"::double precision, "latitude"::double precision),4326)::geography END) STORED,
  PRIMARY KEY ("id")
);

CREATE TABLE "Property" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "ownerId" TEXT NOT NULL,
  "addressId" TEXT NOT NULL,
  "type" "PropertyType" NOT NULL,
  "titleReference" TEXT,
  "ownershipStatus" "VerificationStatus" DEFAULT 'NOT_STARTED' NOT NULL,
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "PropertySpecification" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "propertyId" TEXT NOT NULL,
  "bedrooms" INTEGER,
  "bathrooms" INTEGER,
  "kitchens" INTEGER,
  "floors" INTEGER,
  "parkingSpaces" INTEGER,
  "areaSqFt" DECIMAL(14,2) NOT NULL,
  "landAreaAana" DECIMAL(12,4),
  "builtYear" INTEGER,
  "furnishing" "Furnishing",
  "facing" TEXT,
  "roadAccessFeet" DECIMAL(8,2),
  PRIMARY KEY ("id"),
  UNIQUE ("propertyId")
);

CREATE TABLE "Amenity" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("name"),
  UNIQUE ("slug")
);

CREATE TABLE "PropertyAmenity" (
  "propertyId" TEXT NOT NULL,
  "amenityId" TEXT NOT NULL,
  PRIMARY KEY ("propertyId", "amenityId")
);

CREATE TABLE "PropertyDocument" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "propertyId" TEXT NOT NULL,
  "mediaAssetId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "verifiedAt" TIMESTAMPTZ(3),
  PRIMARY KEY ("id"),
  UNIQUE ("mediaAssetId")
);

CREATE TABLE "Listing" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "propertyId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "agencyId" TEXT,
  "slug" TEXT NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "description" TEXT NOT NULL,
  "type" "ListingType" NOT NULL,
  "status" "ListingStatus" DEFAULT 'DRAFT' NOT NULL,
  "currency" CHAR(3) DEFAULT 'NPR' NOT NULL,
  "priceMinor" BIGINT,
  "rentPeriod" TEXT,
  "isVerified" BOOLEAN DEFAULT FALSE NOT NULL,
  "featuredUntil" TIMESTAMPTZ(3),
  "publishedAt" TIMESTAMPTZ(3),
  "withdrawnAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "version" INTEGER DEFAULT 1 NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("slug")
);

CREATE TABLE "ListingMedia" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "listingId" TEXT NOT NULL,
  "mediaAssetId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "altText" TEXT,
  PRIMARY KEY ("id"),
  UNIQUE ("listingId", "position"),
  UNIQUE ("listingId", "mediaAssetId"),
  UNIQUE ("mediaAssetId")
);

CREATE TABLE "ListingPriceHistory" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "listingId" TEXT NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "priceMinor" BIGINT NOT NULL,
  "changedById" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "ListingStatusHistory" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "listingId" TEXT NOT NULL,
  "fromStatus" "ListingStatus",
  "toStatus" "ListingStatus" NOT NULL,
  "reason" TEXT,
  "actorId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "MediaAsset" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "ownerId" TEXT NOT NULL,
  "purpose" "MediaPurpose" NOT NULL,
  "visibility" "Visibility" NOT NULL,
  "status" "MediaStatus" DEFAULT 'UPLOADING' NOT NULL,
  "bucket" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  "checksum" TEXT,
  "width" INTEGER,
  "height" INTEGER,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "readyAt" TIMESTAMPTZ(3),
  PRIMARY KEY ("id"),
  UNIQUE ("objectKey")
);

CREATE TABLE "MediaVariant" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "mediaAssetId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  PRIMARY KEY ("id"),
  UNIQUE ("objectKey"),
  UNIQUE ("mediaAssetId", "name")
);

CREATE TABLE "Favorite" (
  "userId" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("userId", "listingId")
);

CREATE TABLE "SavedSearch" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "filters" JSONB NOT NULL,
  "alertsEnabled" BOOLEAN DEFAULT FALSE NOT NULL,
  "lastNotifiedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("userId", "name")
);

CREATE TABLE "ListingView" (
  "id" BIGSERIAL,
  "listingId" TEXT NOT NULL,
  "userId" TEXT,
  "visitorHash" TEXT,
  "occurredAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "AgentFollow" (
  "followerId" TEXT NOT NULL,
  "agentUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("followerId", "agentUserId")
);

CREATE TABLE "ListingInquiry" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "listingId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "assignedAgentId" TEXT,
  "message" VARCHAR(2000) NOT NULL,
  "status" "InquiryStatus" DEFAULT 'OPEN' NOT NULL,
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "ViewingRequest" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "listingId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "scheduledAt" TIMESTAMPTZ(3) NOT NULL,
  "status" "ViewingStatus" DEFAULT 'REQUESTED' NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "Conversation" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "conversationKey" TEXT NOT NULL,
  "type" "ConversationType" NOT NULL,
  "listingId" TEXT,
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("conversationKey")
);

CREATE TABLE "ConversationParticipant" (
  "conversationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "joinedAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "lastReadAt" TIMESTAMPTZ(3),
  "archivedAt" TIMESTAMPTZ(3),
  PRIMARY KEY ("conversationId", "userId")
);

CREATE TABLE "Message" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "conversationId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "editedAt" TIMESTAMPTZ(3),
  "deletedAt" TIMESTAMPTZ(3),
  PRIMARY KEY ("id")
);

CREATE TABLE "MessageAttachment" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "messageId" TEXT NOT NULL,
  "mediaAssetId" TEXT NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("messageId", "mediaAssetId")
);

CREATE TABLE "Auction" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "listingId" TEXT NOT NULL,
  "status" "AuctionStatus" DEFAULT 'DRAFT' NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "startingAmountMinor" BIGINT NOT NULL,
  "reserveAmountMinor" BIGINT,
  "currentAmountMinor" BIGINT NOT NULL,
  "currentBidId" TEXT,
  "minimumIncrementMinor" BIGINT NOT NULL,
  "startsAt" TIMESTAMPTZ(3) NOT NULL,
  "originalEndsAt" TIMESTAMPTZ(3) NOT NULL,
  "endsAt" TIMESTAMPTZ(3) NOT NULL,
  "maximumExtendedUntil" TIMESTAMPTZ(3) NOT NULL,
  "extensionWindowSeconds" INTEGER DEFAULT 120 NOT NULL,
  "extensionDurationSeconds" INTEGER DEFAULT 120 NOT NULL,
  "bidCount" INTEGER DEFAULT 0 NOT NULL,
  "sequence" INTEGER DEFAULT 0 NOT NULL,
  "version" INTEGER DEFAULT 1 NOT NULL,
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("listingId"),
  UNIQUE ("currentBidId")
);

CREATE TABLE "AuctionRegistration" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "auctionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "RegistrationStatus" DEFAULT 'PENDING' NOT NULL,
  "depositStatus" "DepositStatus" DEFAULT 'NOT_REQUIRED' NOT NULL,
  "registeredAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "reviewedAt" TIMESTAMPTZ(3),
  PRIMARY KEY ("id"),
  UNIQUE ("auctionId", "userId")
);

CREATE TABLE "Bid" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "auctionId" TEXT NOT NULL,
  "bidderId" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "previousBidId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "acceptedAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "source" TEXT DEFAULT 'HTTP' NOT NULL,
  "requestId" TEXT,
  PRIMARY KEY ("id"),
  UNIQUE ("auctionId", "sequence"),
  UNIQUE ("auctionId", "bidderId", "idempotencyKey")
);

CREATE TABLE "AuctionExtension" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "auctionId" TEXT NOT NULL,
  "bidId" TEXT NOT NULL,
  "previousEndsAt" TIMESTAMPTZ(3) NOT NULL,
  "newEndsAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("auctionId", "bidId")
);

CREATE TABLE "AuctionSettlement" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "auctionId" TEXT NOT NULL,
  "winningBidId" TEXT,
  "buyerId" TEXT,
  "sellerId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "dueAt" TIMESTAMPTZ(3),
  "settledAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("auctionId")
);

CREATE TABLE "AuctionDeposit" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "registrationId" TEXT NOT NULL,
  "paymentIntentId" TEXT,
  "amountMinor" BIGINT NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "status" "DepositStatus" NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("registrationId"),
  UNIQUE ("paymentIntentId")
);

CREATE TABLE "PaymentIntent" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerReference" TEXT,
  "purpose" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "status" "PaymentStatus" DEFAULT 'CREATED' NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("providerReference")
);

CREATE TABLE "PaymentTransaction" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "paymentIntentId" TEXT NOT NULL,
  "providerEventId" TEXT,
  "type" TEXT NOT NULL,
  "status" "PaymentStatus" NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "rawPayload" JSONB,
  "occurredAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("providerEventId")
);

CREATE TABLE "WebhookEvent" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "provider" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "processedAt" TIMESTAMPTZ(3),
  "failedAt" TIMESTAMPTZ(3),
  "error" TEXT,
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("provider", "providerEventId")
);

CREATE TABLE "Notification" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "data" JSONB,
  "readAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "NotificationDelivery" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "notificationId" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "status" "DeliveryStatus" DEFAULT 'PENDING' NOT NULL,
  "attemptCount" INTEGER DEFAULT 0 NOT NULL,
  "lastAttemptAt" TIMESTAMPTZ(3),
  "error" TEXT,
  PRIMARY KEY ("id"),
  UNIQUE ("notificationId", "channel")
);

CREATE TABLE "PushSubscription" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("endpoint")
);

CREATE TABLE "UserReport" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "reporterId" TEXT NOT NULL,
  "reportedUserId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "details" TEXT,
  "status" "ModerationStatus" DEFAULT 'OPEN' NOT NULL,
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "ListingReport" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "listingId" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "details" TEXT,
  "status" "ModerationStatus" DEFAULT 'OPEN' NOT NULL,
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "IdempotencyKey" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "userId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "responseStatus" INTEGER,
  "responseBody" JSONB,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("userId", "scope", "key")
);

CREATE TABLE "OutboxEvent" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "OutboxStatus" DEFAULT 'PENDING' NOT NULL,
  "attempts" INTEGER DEFAULT 0 NOT NULL,
  "availableAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "publishedAt" TIMESTAMPTZ(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "actorId" TEXT,
  "action" "AuditAction" NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "reason" TEXT,
  "before" JSONB,
  "after" JSONB,
  "requestId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("id")
);

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Passkey" ADD CONSTRAINT "Passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TwoFactor" ADD CONSTRAINT "TwoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IdentityVerification" ADD CONSTRAINT "IdentityVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencyMember" ADD CONSTRAINT "AgencyMember_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencyMember" ADD CONSTRAINT "AgencyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentReview" ADD CONSTRAINT "AgentReview_agentProfileId_fkey" FOREIGN KEY ("agentProfileId") REFERENCES "AgentProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentReview" ADD CONSTRAINT "AgentReview_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdministrativeArea" ADD CONSTRAINT "AdministrativeArea_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AdministrativeArea" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Address" ADD CONSTRAINT "Address_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "AdministrativeArea" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Property" ADD CONSTRAINT "Property_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Property" ADD CONSTRAINT "Property_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropertySpecification" ADD CONSTRAINT "PropertySpecification_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyAmenity" ADD CONSTRAINT "PropertyAmenity_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyAmenity" ADD CONSTRAINT "PropertyAmenity_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "Amenity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropertyDocument" ADD CONSTRAINT "PropertyDocument_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyDocument" ADD CONSTRAINT "PropertyDocument_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ListingMedia" ADD CONSTRAINT "ListingMedia_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingMedia" ADD CONSTRAINT "ListingMedia_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ListingPriceHistory" ADD CONSTRAINT "ListingPriceHistory_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingPriceHistory" ADD CONSTRAINT "ListingPriceHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ListingStatusHistory" ADD CONSTRAINT "ListingStatusHistory_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingStatusHistory" ADD CONSTRAINT "ListingStatusHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MediaVariant" ADD CONSTRAINT "MediaVariant_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingView" ADD CONSTRAINT "ListingView_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentFollow" ADD CONSTRAINT "AgentFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentFollow" ADD CONSTRAINT "AgentFollow_agentUserId_fkey" FOREIGN KEY ("agentUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingInquiry" ADD CONSTRAINT "ListingInquiry_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ListingInquiry" ADD CONSTRAINT "ListingInquiry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ViewingRequest" ADD CONSTRAINT "ViewingRequest_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ViewingRequest" ADD CONSTRAINT "ViewingRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_currentBidId_fkey" FOREIGN KEY ("currentBidId") REFERENCES "Bid" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuctionRegistration" ADD CONSTRAINT "AuctionRegistration_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuctionRegistration" ADD CONSTRAINT "AuctionRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_previousBidId_fkey" FOREIGN KEY ("previousBidId") REFERENCES "Bid" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuctionExtension" ADD CONSTRAINT "AuctionExtension_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuctionExtension" ADD CONSTRAINT "AuctionExtension_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuctionSettlement" ADD CONSTRAINT "AuctionSettlement_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuctionSettlement" ADD CONSTRAINT "AuctionSettlement_winningBidId_fkey" FOREIGN KEY ("winningBidId") REFERENCES "Bid" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuctionSettlement" ADD CONSTRAINT "AuctionSettlement_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuctionSettlement" ADD CONSTRAINT "AuctionSettlement_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuctionDeposit" ADD CONSTRAINT "AuctionDeposit_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "AuctionRegistration" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuctionDeposit" ADD CONSTRAINT "AuctionDeposit_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ListingReport" ADD CONSTRAINT "ListingReport_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ListingReport" ADD CONSTRAINT "ListingReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "User_role_createdAt_idx" ON "User" USING BTREE ("role", "createdAt");
CREATE INDEX "User_banned_createdAt_idx" ON "User" USING BTREE ("banned", "createdAt");
CREATE INDEX "User_lifecycleStatus_createdAt_idx" ON "User" USING BTREE ("lifecycleStatus", "createdAt");
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session" USING BTREE ("userId", "expiresAt");
CREATE INDEX "Session_expiresAt_idx" ON "Session" USING BTREE ("expiresAt");
CREATE INDEX "Account_userId_idx" ON "Account" USING BTREE ("userId");
CREATE INDEX "Verification_identifier_idx" ON "Verification" USING BTREE ("identifier");
CREATE INDEX "Verification_expiresAt_idx" ON "Verification" USING BTREE ("expiresAt");
CREATE INDEX "Passkey_userId_idx" ON "Passkey" USING BTREE ("userId");
CREATE INDEX "TwoFactor_userId_idx" ON "TwoFactor" USING BTREE ("userId");
CREATE INDEX "UserProfile_lastSeenAt_idx" ON "UserProfile" USING BTREE ("lastSeenAt");
CREATE INDEX "IdentityVerification_status_submittedAt_idx" ON "IdentityVerification" USING BTREE ("status", "submittedAt");
CREATE INDEX "Agency_verifiedAt_createdAt_idx" ON "Agency" USING BTREE ("verifiedAt", "createdAt");
CREATE INDEX "AgencyMember_userId_role_idx" ON "AgencyMember" USING BTREE ("userId", "role");
CREATE INDEX "AgentProfile_verifiedAt_averageRating_idx" ON "AgentProfile" USING BTREE ("verifiedAt", "averageRating");
CREATE INDEX "AgentReview_agentProfileId_createdAt_idx" ON "AgentReview" USING BTREE ("agentProfileId", "createdAt");
CREATE INDEX "AdministrativeArea_level_name_idx" ON "AdministrativeArea" USING BTREE ("level", "name");
CREATE INDEX "Address_district_municipality_locality_idx" ON "Address" USING BTREE ("district", "municipality", "locality");
CREATE INDEX "Address_location_idx" ON "Address" USING GIST ("location");
CREATE INDEX "Property_ownerId_createdAt_idx" ON "Property" USING BTREE ("ownerId", "createdAt");
CREATE INDEX "Property_type_ownershipStatus_idx" ON "Property" USING BTREE ("type", "ownershipStatus");
CREATE INDEX "Property_addressId_idx" ON "Property" USING BTREE ("addressId");
CREATE INDEX "PropertyAmenity_amenityId_propertyId_idx" ON "PropertyAmenity" USING BTREE ("amenityId", "propertyId");
CREATE INDEX "PropertyDocument_propertyId_type_idx" ON "PropertyDocument" USING BTREE ("propertyId", "type");
CREATE INDEX "Listing_status_publishedAt_DESC_id_DESC_idx" ON "Listing" USING BTREE ("status", "publishedAt" DESC, "id" DESC);
CREATE INDEX "Listing_status_type_priceMinor_id_idx" ON "Listing" USING BTREE ("status", "type", "priceMinor", "id");
CREATE INDEX "Listing_status_featuredUntil_publishedAt_idx" ON "Listing" USING BTREE ("status", "featuredUntil", "publishedAt");
CREATE INDEX "Listing_propertyId_createdAt_idx" ON "Listing" USING BTREE ("propertyId", "createdAt");
CREATE INDEX "Listing_createdById_status_createdAt_idx" ON "Listing" USING BTREE ("createdById", "status", "createdAt");
CREATE INDEX "Listing_agencyId_status_createdAt_idx" ON "Listing" USING BTREE ("agencyId", "status", "createdAt");
CREATE INDEX "ListingPriceHistory_listingId_createdAt_DESC_idx" ON "ListingPriceHistory" USING BTREE ("listingId", "createdAt" DESC);
CREATE INDEX "ListingPriceHistory_changedById_createdAt_DESC_idx" ON "ListingPriceHistory" USING BTREE ("changedById", "createdAt" DESC);
CREATE INDEX "ListingStatusHistory_listingId_createdAt_DESC_idx" ON "ListingStatusHistory" USING BTREE ("listingId", "createdAt" DESC);
CREATE INDEX "ListingStatusHistory_actorId_createdAt_DESC_idx" ON "ListingStatusHistory" USING BTREE ("actorId", "createdAt" DESC);
CREATE INDEX "MediaAsset_ownerId_status_createdAt_idx" ON "MediaAsset" USING BTREE ("ownerId", "status", "createdAt");
CREATE INDEX "MediaAsset_status_createdAt_idx" ON "MediaAsset" USING BTREE ("status", "createdAt");
CREATE INDEX "Favorite_listingId_createdAt_idx" ON "Favorite" USING BTREE ("listingId", "createdAt");
CREATE INDEX "SavedSearch_userId_createdAt_idx" ON "SavedSearch" USING BTREE ("userId", "createdAt");
CREATE INDEX "SavedSearch_alertsEnabled_lastNotifiedAt_idx" ON "SavedSearch" USING BTREE ("alertsEnabled", "lastNotifiedAt");
CREATE INDEX "ListingView_listingId_occurredAt_idx" ON "ListingView" USING BTREE ("listingId", "occurredAt");
CREATE INDEX "ListingView_userId_occurredAt_idx" ON "ListingView" USING BTREE ("userId", "occurredAt");
CREATE INDEX "AgentFollow_agentUserId_createdAt_idx" ON "AgentFollow" USING BTREE ("agentUserId", "createdAt");
CREATE INDEX "ListingInquiry_listingId_status_createdAt_idx" ON "ListingInquiry" USING BTREE ("listingId", "status", "createdAt");
CREATE INDEX "ListingInquiry_assignedAgentId_status_createdAt_idx" ON "ListingInquiry" USING BTREE ("assignedAgentId", "status", "createdAt");
CREATE INDEX "ListingInquiry_userId_createdAt_idx" ON "ListingInquiry" USING BTREE ("userId", "createdAt");
CREATE INDEX "ViewingRequest_listingId_scheduledAt_idx" ON "ViewingRequest" USING BTREE ("listingId", "scheduledAt");
CREATE INDEX "ViewingRequest_requesterId_status_scheduledAt_idx" ON "ViewingRequest" USING BTREE ("requesterId", "status", "scheduledAt");
CREATE INDEX "Conversation_listingId_updatedAt_idx" ON "Conversation" USING BTREE ("listingId", "updatedAt");
CREATE INDEX "ConversationParticipant_userId_archivedAt_conversationId_idx" ON "ConversationParticipant" USING BTREE ("userId", "archivedAt", "conversationId");
CREATE INDEX "Message_conversationId_createdAt_id_idx" ON "Message" USING BTREE ("conversationId", "createdAt", "id");
CREATE INDEX "Message_senderId_createdAt_idx" ON "Message" USING BTREE ("senderId", "createdAt");
CREATE INDEX "MessageAttachment_messageId_idx" ON "MessageAttachment" USING BTREE ("messageId");
CREATE INDEX "MessageAttachment_mediaAssetId_idx" ON "MessageAttachment" USING BTREE ("mediaAssetId");
CREATE INDEX "Auction_status_startsAt_idx" ON "Auction" USING BTREE ("status", "startsAt");
CREATE INDEX "Auction_status_endsAt_idx" ON "Auction" USING BTREE ("status", "endsAt");
CREATE INDEX "AuctionRegistration_auctionId_status_idx" ON "AuctionRegistration" USING BTREE ("auctionId", "status");
CREATE INDEX "AuctionRegistration_userId_status_registeredAt_idx" ON "AuctionRegistration" USING BTREE ("userId", "status", "registeredAt");
CREATE INDEX "Bid_auctionId_acceptedAt_id_idx" ON "Bid" USING BTREE ("auctionId", "acceptedAt", "id");
CREATE INDEX "Bid_bidderId_acceptedAt_idx" ON "Bid" USING BTREE ("bidderId", "acceptedAt");
CREATE INDEX "AuctionExtension_auctionId_createdAt_idx" ON "AuctionExtension" USING BTREE ("auctionId", "createdAt");
CREATE INDEX "AuctionSettlement_status_dueAt_idx" ON "AuctionSettlement" USING BTREE ("status", "dueAt");
CREATE INDEX "PaymentIntent_userId_status_createdAt_idx" ON "PaymentIntent" USING BTREE ("userId", "status", "createdAt");
CREATE INDEX "PaymentIntent_provider_providerReference_idx" ON "PaymentIntent" USING BTREE ("provider", "providerReference");
CREATE INDEX "PaymentTransaction_paymentIntentId_occurredAt_idx" ON "PaymentTransaction" USING BTREE ("paymentIntentId", "occurredAt");
CREATE INDEX "WebhookEvent_processedAt_createdAt_idx" ON "WebhookEvent" USING BTREE ("processedAt", "createdAt");
CREATE INDEX "Notification_userId_readAt_createdAt_DESC_idx" ON "Notification" USING BTREE ("userId", "readAt", "createdAt" DESC);
CREATE INDEX "NotificationDelivery_status_lastAttemptAt_idx" ON "NotificationDelivery" USING BTREE ("status", "lastAttemptAt");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription" USING BTREE ("userId");
CREATE INDEX "UserReport_status_createdAt_idx" ON "UserReport" USING BTREE ("status", "createdAt");
CREATE INDEX "UserReport_reportedUserId_status_idx" ON "UserReport" USING BTREE ("reportedUserId", "status");
CREATE INDEX "ListingReport_status_createdAt_idx" ON "ListingReport" USING BTREE ("status", "createdAt");
CREATE INDEX "ListingReport_listingId_status_idx" ON "ListingReport" USING BTREE ("listingId", "status");
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey" USING BTREE ("expiresAt");
CREATE INDEX "OutboxEvent_status_availableAt_createdAt_idx" ON "OutboxEvent" USING BTREE ("status", "availableAt", "createdAt");
CREATE INDEX "OutboxEvent_aggregateType_aggregateId_createdAt_idx" ON "OutboxEvent" USING BTREE ("aggregateType", "aggregateId", "createdAt");
CREATE INDEX "AuditLog_entityType_entityId_createdAt_DESC_idx" ON "AuditLog" USING BTREE ("entityType", "entityId", "createdAt" DESC);
CREATE INDEX "AuditLog_actorId_createdAt_DESC_idx" ON "AuditLog" USING BTREE ("actorId", "createdAt" DESC);
CREATE INDEX "AuditLog_action_createdAt_DESC_idx" ON "AuditLog" USING BTREE ("action", "createdAt" DESC);

ALTER TABLE "Listing" ADD COLUMN "searchDocument" tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce("title",'') || ' ' || coalesce("description",''))) STORED;
CREATE INDEX "Listing_searchDocument_idx" ON "Listing" USING GIN ("searchDocument");
CREATE INDEX "Listing_title_trgm_idx" ON "Listing" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "Address_locality_trgm_idx" ON "Address" USING GIN ("locality" gin_trgm_ops);
CREATE INDEX "Address_public_location_idx" ON "Address" USING GIST (geography(ST_SetSRID(ST_MakePoint("publicLongitude"::double precision, "publicLatitude"::double precision),4326))) WHERE "publicLongitude" IS NOT NULL AND "publicLatitude" IS NOT NULL;

-- The platform uses Prisma to maintain updatedAt values. Raw SQL writes must set them explicitly.
