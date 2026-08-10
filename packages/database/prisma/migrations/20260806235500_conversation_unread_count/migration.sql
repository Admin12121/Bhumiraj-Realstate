ALTER TABLE "ConversationParticipant"
ADD COLUMN IF NOT EXISTS "unreadCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "ConversationParticipant_userId_unreadCount_idx"
ON "ConversationParticipant"("userId", "unreadCount");
