CREATE INDEX IF NOT EXISTS "AgentReview_authorId_createdAt_idx" ON "AgentReview"("authorId", "createdAt");
CREATE INDEX IF NOT EXISTS "Address_areaId_idx" ON "Address"("areaId");
CREATE INDEX IF NOT EXISTS "Bid_previousBidId_idx" ON "Bid"("previousBidId");
CREATE INDEX IF NOT EXISTS "AuctionExtension_bidId_idx" ON "AuctionExtension"("bidId");
CREATE INDEX IF NOT EXISTS "AuctionSettlement_winningBidId_idx" ON "AuctionSettlement"("winningBidId");
CREATE INDEX IF NOT EXISTS "AuctionSettlement_buyerId_idx" ON "AuctionSettlement"("buyerId");
CREATE INDEX IF NOT EXISTS "AuctionSettlement_sellerId_idx" ON "AuctionSettlement"("sellerId");
CREATE INDEX IF NOT EXISTS "UserReport_reporterId_createdAt_idx" ON "UserReport"("reporterId", "createdAt");
CREATE INDEX IF NOT EXISTS "ListingReport_reporterId_createdAt_idx" ON "ListingReport"("reporterId", "createdAt");
