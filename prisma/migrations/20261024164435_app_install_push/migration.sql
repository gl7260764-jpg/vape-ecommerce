-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VisitorEventType" ADD VALUE 'install_app';
ALTER TYPE "VisitorEventType" ADD VALUE 'enable_notifications';

-- AlterTable
ALTER TABLE "ChatConversation" ADD COLUMN     "lastPushAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "appInstalledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "NewsletterSettings" ADD COLUMN     "installOffersEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "discountLabel" TEXT;

-- AlterTable
ALTER TABLE "Visitor" ADD COLUMN     "appInstalledAt" TIMESTAMP(3),
ADD COLUMN     "appPlatform" TEXT;

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "deviceTokenHash" TEXT NOT NULL,
    "visitorId" TEXT,
    "platform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_deviceTokenHash_idx" ON "PushSubscription"("deviceTokenHash");

-- CreateIndex
CREATE INDEX "PushSubscription_visitorId_idx" ON "PushSubscription"("visitorId");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

