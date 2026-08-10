-- Prevent a private uploaded object from being re-used across multiple messages.
CREATE UNIQUE INDEX "MessageAttachment_mediaAssetId_key"
ON "MessageAttachment"("mediaAssetId");

-- Geographic and property integrity.
ALTER TABLE "Address"
  ADD CONSTRAINT "Address_latitude_range_check"
    CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
  ADD CONSTRAINT "Address_longitude_range_check"
    CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180),
  ADD CONSTRAINT "Address_public_latitude_range_check"
    CHECK ("publicLatitude" IS NULL OR "publicLatitude" BETWEEN -90 AND 90),
  ADD CONSTRAINT "Address_public_longitude_range_check"
    CHECK ("publicLongitude" IS NULL OR "publicLongitude" BETWEEN -180 AND 180);

ALTER TABLE "PropertySpecification"
  ADD CONSTRAINT "PropertySpecification_area_positive_check"
    CHECK ("areaSqFt" > 0),
  ADD CONSTRAINT "PropertySpecification_counts_nonnegative_check"
    CHECK (
      COALESCE("bedrooms", 0) >= 0 AND
      COALESCE("bathrooms", 0) >= 0 AND
      COALESCE("kitchens", 0) >= 0 AND
      COALESCE("floors", 0) >= 0 AND
      COALESCE("parkingSpaces", 0) >= 0
    ),
  ADD CONSTRAINT "PropertySpecification_land_area_positive_check"
    CHECK ("landAreaAana" IS NULL OR "landAreaAana" > 0),
  ADD CONSTRAINT "PropertySpecification_road_access_positive_check"
    CHECK ("roadAccessFeet" IS NULL OR "roadAccessFeet" >= 0),
  ADD CONSTRAINT "PropertySpecification_built_year_check"
    CHECK ("builtYear" IS NULL OR "builtYear" BETWEEN 1800 AND 2200);

-- Marketplace counters and money must never drift below zero.
ALTER TABLE "Listing"
  ADD CONSTRAINT "Listing_price_check"
    CHECK (
      ("type" = 'AUCTION' AND "priceMinor" IS NULL) OR
      ("type" IN ('SALE', 'RENT') AND "priceMinor" IS NOT NULL AND "priceMinor" > 0)
    ),
  ADD CONSTRAINT "Listing_counters_nonnegative_check"
    CHECK ("favoriteCount" >= 0 AND "inquiryCount" >= 0 AND "viewCount" >= 0),
  ADD CONSTRAINT "Listing_version_positive_check"
    CHECK ("version" > 0);

ALTER TABLE "ListingMedia"
  ADD CONSTRAINT "ListingMedia_position_nonnegative_check"
    CHECK ("position" >= 0);

ALTER TABLE "MediaAsset"
  ADD CONSTRAINT "MediaAsset_size_positive_check"
    CHECK ("sizeBytes" > 0),
  ADD CONSTRAINT "MediaAsset_dimensions_positive_check"
    CHECK (
      ("width" IS NULL OR "width" > 0) AND
      ("height" IS NULL OR "height" > 0)
    );

ALTER TABLE "MediaVariant"
  ADD CONSTRAINT "MediaVariant_size_positive_check"
    CHECK ("sizeBytes" > 0),
  ADD CONSTRAINT "MediaVariant_dimensions_positive_check"
    CHECK (
      ("width" IS NULL OR "width" > 0) AND
      ("height" IS NULL OR "height" > 0)
    );

ALTER TABLE "AgentProfile"
  ADD CONSTRAINT "AgentProfile_rating_check"
    CHECK ("averageRating" BETWEEN 0 AND 5 AND "reviewCount" >= 0);

ALTER TABLE "AgentReview"
  ADD CONSTRAINT "AgentReview_rating_check"
    CHECK ("rating" BETWEEN 1 AND 5);

ALTER TABLE "ConversationParticipant"
  ADD CONSTRAINT "ConversationParticipant_unread_nonnegative_check"
    CHECK ("unreadCount" >= 0);

-- Auction and bid consistency. PostgreSQL remains authoritative.
ALTER TABLE "Auction"
  ADD CONSTRAINT "Auction_amounts_check"
    CHECK (
      "startingAmountMinor" > 0 AND
      "currentAmountMinor" >= "startingAmountMinor" AND
      "minimumIncrementMinor" > 0 AND
      ("reserveAmountMinor" IS NULL OR "reserveAmountMinor" >= "startingAmountMinor")
    ),
  ADD CONSTRAINT "Auction_time_order_check"
    CHECK (
      "originalEndsAt" > "startsAt" AND
      "endsAt" >= "originalEndsAt" AND
      "maximumExtendedUntil" >= "endsAt"
    ),
  ADD CONSTRAINT "Auction_counters_check"
    CHECK (
      "bidCount" >= 0 AND
      "sequence" >= 0 AND
      "eventSequence" >= 0 AND
      "version" > 0
    ),
  ADD CONSTRAINT "Auction_extension_settings_check"
    CHECK (
      "extensionWindowSeconds" > 0 AND
      "extensionDurationSeconds" > 0
    );

ALTER TABLE "Bid"
  ADD CONSTRAINT "Bid_amount_sequence_check"
    CHECK ("amountMinor" > 0 AND "sequence" > 0);

ALTER TABLE "AuctionExtension"
  ADD CONSTRAINT "AuctionExtension_time_order_check"
    CHECK ("newEndsAt" > "previousEndsAt");

ALTER TABLE "AuctionDeposit"
  ADD CONSTRAINT "AuctionDeposit_amount_nonnegative_check"
    CHECK ("amountMinor" >= 0);

ALTER TABLE "PaymentIntent"
  ADD CONSTRAINT "PaymentIntent_amount_nonnegative_check"
    CHECK ("amountMinor" >= 0);

ALTER TABLE "PaymentTransaction"
  ADD CONSTRAINT "PaymentTransaction_amount_nonnegative_check"
    CHECK ("amountMinor" >= 0);

ALTER TABLE "NotificationDelivery"
  ADD CONSTRAINT "NotificationDelivery_attempts_nonnegative_check"
    CHECK ("attemptCount" >= 0);

ALTER TABLE "OutboxEvent"
  ADD CONSTRAINT "OutboxEvent_attempts_nonnegative_check"
    CHECK ("attempts" >= 0);
