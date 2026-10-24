-- CreateEnum
CREATE TYPE "TrafficChannel" AS ENUM ('direct', 'organic', 'ai', 'social', 'email', 'paid', 'referral');

-- CreateEnum
CREATE TYPE "VisitorEventType" AS ENUM ('page_view', 'add_to_cart', 'remove_from_cart', 'open_cart', 'search', 'begin_checkout', 'place_order', 'subscribe');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "visitorId" TEXT;

-- AlterTable
ALTER TABLE "Subscriber" ADD COLUMN     "source" TEXT,
ADD COLUMN     "visitorId" TEXT;

-- CreateTable
CREATE TABLE "Visitor" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "identifiedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionCount" INTEGER NOT NULL DEFAULT 0,
    "pageviewCount" INTEGER NOT NULL DEFAULT 0,
    "firstSource" TEXT,
    "firstChannel" "TrafficChannel",
    "firstReferrer" TEXT,
    "firstLanding" TEXT,
    "firstUtmSource" TEXT,
    "firstUtmMedium" TEXT,
    "firstUtmCampaign" TEXT,
    "ip" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "device" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Visitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitorSession" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "landingPath" TEXT NOT NULL,
    "exitPath" TEXT,
    "referrer" TEXT,
    "referrerHost" TEXT,
    "source" TEXT NOT NULL,
    "channel" "TrafficChannel" NOT NULL,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "ip" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "device" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "pageviews" INTEGER NOT NULL DEFAULT 0,
    "eventCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VisitorSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitorEvent" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "VisitorEventType" NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT,
    "label" TEXT,
    "value" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Visitor_lastSeenAt_idx" ON "Visitor"("lastSeenAt");

-- CreateIndex
CREATE INDEX "Visitor_firstSeenAt_idx" ON "Visitor"("firstSeenAt");

-- CreateIndex
CREATE INDEX "Visitor_email_idx" ON "Visitor"("email");

-- CreateIndex
CREATE INDEX "Visitor_country_idx" ON "Visitor"("country");

-- CreateIndex
CREATE INDEX "VisitorSession_startedAt_idx" ON "VisitorSession"("startedAt");

-- CreateIndex
CREATE INDEX "VisitorSession_lastSeenAt_idx" ON "VisitorSession"("lastSeenAt");

-- CreateIndex
CREATE INDEX "VisitorSession_visitorId_startedAt_idx" ON "VisitorSession"("visitorId", "startedAt");

-- CreateIndex
CREATE INDEX "VisitorEvent_sessionId_createdAt_idx" ON "VisitorEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "VisitorEvent_visitorId_createdAt_idx" ON "VisitorEvent"("visitorId", "createdAt");

-- CreateIndex
CREATE INDEX "VisitorEvent_type_createdAt_idx" ON "VisitorEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "VisitorEvent_createdAt_idx" ON "VisitorEvent"("createdAt");

-- CreateIndex
CREATE INDEX "Order_visitorId_idx" ON "Order"("visitorId");

-- CreateIndex
CREATE INDEX "Subscriber_visitorId_idx" ON "Subscriber"("visitorId");

-- CreateIndex
CREATE INDEX "Subscriber_createdAt_idx" ON "Subscriber"("createdAt");

-- AddForeignKey
ALTER TABLE "Subscriber" ADD CONSTRAINT "Subscriber_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorSession" ADD CONSTRAINT "VisitorSession_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorEvent" ADD CONSTRAINT "VisitorEvent_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorEvent" ADD CONSTRAINT "VisitorEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VisitorSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

