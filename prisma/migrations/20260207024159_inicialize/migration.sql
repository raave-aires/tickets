-- CreateEnum
CREATE TYPE "TicketComplexity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'PENDING', 'RESOLVED', 'SNOOZED');

-- CreateEnum
CREATE TYPE "RequestTarget" AS ENUM ('SELF', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketMessageType" AS ENUM ('INCOMING', 'OUTGOING', 'ACTIVITY', 'SYSTEM');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "idToken" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_conversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "complexity" "TicketComplexity" NOT NULL,
    "sector" TEXT NOT NULL,
    "requestTarget" "RequestTarget" NOT NULL,
    "requestForName" TEXT,
    "requestForEmail" TEXT,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "chatwootConversationId" INTEGER,
    "chatwootContactId" TEXT NOT NULL,
    "chatwootPubsubToken" TEXT NOT NULL,
    "chatwootSourceId" TEXT,
    "chatwootInboxIdentifier" TEXT NOT NULL,
    "assignedAgentId" INTEGER,
    "assignedAgentName" TEXT,
    "assignedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "reopenedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "chatwootMessageId" INTEGER,
    "messageType" "TicketMessageType" NOT NULL,
    "content" TEXT NOT NULL,
    "senderName" TEXT,
    "senderType" TEXT,
    "echoId" TEXT,
    "externalCreatedAt" TIMESTAMP(3),
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_event" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "payload" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatwoot_webhook_delivery" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "chatwootConversationId" INTEGER,
    "ticketConversationId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatwoot_webhook_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatwoot_contact_link" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inboxIdentifier" TEXT NOT NULL,
    "contactIdentifier" TEXT NOT NULL,
    "sourceId" TEXT,
    "pubsubToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chatwoot_contact_link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_conversation_chatwootConversationId_key" ON "ticket_conversation"("chatwootConversationId");

-- CreateIndex
CREATE INDEX "ticket_conversation_userId_createdAt_idx" ON "ticket_conversation"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ticket_conversation_chatwootConversationId_idx" ON "ticket_conversation"("chatwootConversationId");

-- CreateIndex
CREATE INDEX "ticket_message_conversationId_createdAt_idx" ON "ticket_message"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_message_conversationId_chatwootMessageId_key" ON "ticket_message"("conversationId", "chatwootMessageId");

-- CreateIndex
CREATE INDEX "ticket_event_conversationId_occurredAt_idx" ON "ticket_event"("conversationId", "occurredAt");

-- CreateIndex
CREATE INDEX "chatwoot_webhook_delivery_event_createdAt_idx" ON "chatwoot_webhook_delivery"("event", "createdAt");

-- CreateIndex
CREATE INDEX "chatwoot_webhook_delivery_chatwootConversationId_idx" ON "chatwoot_webhook_delivery"("chatwootConversationId");

-- CreateIndex
CREATE INDEX "chatwoot_contact_link_userId_idx" ON "chatwoot_contact_link"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "chatwoot_contact_link_userId_inboxIdentifier_key" ON "chatwoot_contact_link"("userId", "inboxIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "chatwoot_contact_link_inboxIdentifier_contactIdentifier_key" ON "chatwoot_contact_link"("inboxIdentifier", "contactIdentifier");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_conversation" ADD CONSTRAINT "ticket_conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_message" ADD CONSTRAINT "ticket_message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ticket_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_event" ADD CONSTRAINT "ticket_event_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ticket_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatwoot_webhook_delivery" ADD CONSTRAINT "chatwoot_webhook_delivery_ticketConversationId_fkey" FOREIGN KEY ("ticketConversationId") REFERENCES "ticket_conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatwoot_contact_link" ADD CONSTRAINT "chatwoot_contact_link_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
