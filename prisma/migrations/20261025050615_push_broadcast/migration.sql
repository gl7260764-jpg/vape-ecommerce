-- CreateTable
CREATE TABLE "PushBroadcast" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "image" TEXT,
    "sentById" TEXT,
    "sentCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushBroadcast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PushBroadcast_createdAt_idx" ON "PushBroadcast"("createdAt");

-- CreateIndex
CREATE INDEX "PushBroadcast_productId_idx" ON "PushBroadcast"("productId");

-- AddForeignKey
ALTER TABLE "PushBroadcast" ADD CONSTRAINT "PushBroadcast_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushBroadcast" ADD CONSTRAINT "PushBroadcast_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

