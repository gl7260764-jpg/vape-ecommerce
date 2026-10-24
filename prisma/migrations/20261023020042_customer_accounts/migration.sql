-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerId" TEXT;

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderAccess" (
    "tokenHash" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderAccess_pkey" PRIMARY KEY ("tokenHash","orderId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "OrderAccess_orderId_idx" ON "OrderAccess"("orderId");

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAccess" ADD CONSTRAINT "OrderAccess_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: one account per email from orders placed before accounts existed (latest details win).
INSERT INTO "Customer" ("id", "email", "name", "phone", "createdAt", "updatedAt")
SELECT DISTINCT ON (lower(o."email")) gen_random_uuid()::text, lower(o."email"), o."fullName", o."phone", o."createdAt", now()
FROM "Order" o
ORDER BY lower(o."email"), o."createdAt" DESC;

UPDATE "Order" o SET "customerId" = c."id" FROM "Customer" c WHERE c."email" = lower(o."email");
