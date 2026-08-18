-- General-enquiry support chat. Kept separate from Conversation, which requires
-- a User on both sides and so cannot serve signed-out visitors.

-- CreateEnum
CREATE TYPE "SupportAuthorRole" AS ENUM ('VISITOR', 'STAFF');
CREATE TYPE "SupportThreadStatus" AS ENUM ('OPEN', 'ASSIGNED', 'CLOSED');

-- CreateTable
CREATE TABLE "SupportThread" (
    "id" TEXT NOT NULL,
    "visitorKey" TEXT,
    "userId" TEXT,
    "status" "SupportThreadStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "subject" VARCHAR(160),
    "lastMessageAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SupportThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorRole" "SupportAuthorRole" NOT NULL,
    "authorId" TEXT,
    "body" VARCHAR(4000) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportThread_visitorKey_key" ON "SupportThread"("visitorKey");
CREATE INDEX "SupportThread_status_lastMessageAt_idx" ON "SupportThread"("status", "lastMessageAt" DESC);
CREATE INDEX "SupportThread_assignedToId_status_lastMessageAt_idx" ON "SupportThread"("assignedToId", "status", "lastMessageAt" DESC);
CREATE INDEX "SupportThread_userId_lastMessageAt_idx" ON "SupportThread"("userId", "lastMessageAt" DESC);
CREATE INDEX "SupportThread_expiresAt_idx" ON "SupportThread"("expiresAt");
CREATE INDEX "SupportMessage_threadId_createdAt_id_idx" ON "SupportMessage"("threadId", "createdAt", "id");
CREATE INDEX "SupportMessage_authorId_createdAt_idx" ON "SupportMessage"("authorId", "createdAt");

-- AddForeignKey
ALTER TABLE "SupportThread" ADD CONSTRAINT "SupportThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportThread" ADD CONSTRAINT "SupportThread_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "SupportThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
