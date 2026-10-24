-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('in_stock', 'out_of_stock', 'on_backorder');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('disposable', 'e_liquid', 'pod_kit', 'accessory', 'nicotine_pouch', 'cbd', 'glassware', 'bundle', 'other');

-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('type', 'brand', 'series', 'collection');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FlavourFamily" ADD VALUE 'tobacco';
ALTER TYPE "FlavourFamily" ADD VALUE 'mint';
ALTER TYPE "FlavourFamily" ADD VALUE 'drink';

-- DropIndex
DROP INDEX "Product_collection_sortOrder_idx";

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "blurb",
DROP COLUMN "count",
ADD COLUMN     "brandId" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "imageSourceUrl" TEXT,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "kind" "CategoryKind" NOT NULL DEFAULT 'type',
ADD COLUMN     "metaDescription" TEXT,
ADD COLUMN     "metaTitle" TEXT,
ADD COLUMN     "needsReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "reviewNotes" TEXT[],
ADD COLUMN     "tagline" TEXT,
ADD COLUMN     "wooId" INTEGER,
ALTER COLUMN "imageKey" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "collection",
DROP COLUMN "compareAt",
DROP COLUMN "family",
DROP COLUMN "imageKey",
DROP COLUMN "line",
DROP COLUMN "price",
DROP COLUMN "sortOrder",
ADD COLUMN     "brandId" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "flavourFamily" "FlavourFamily",
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPurchasable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "metaDescription" TEXT,
ADD COLUMN     "metaTitle" TEXT,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "needsReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nicotineMg" DECIMAL(7,2),
ADD COLUMN     "packSize" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "priceCents" INTEGER NOT NULL,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "regularPriceCents" INTEGER NOT NULL,
ADD COLUMN     "reviewNotes" TEXT[],
ADD COLUMN     "shortDescription" TEXT,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "sourceName" TEXT,
ADD COLUMN     "status" "ProductStatus" NOT NULL DEFAULT 'active',
ADD COLUMN     "stockQuantity" INTEGER,
ADD COLUMN     "stockStatus" "StockStatus" NOT NULL DEFAULT 'in_stock',
ADD COLUMN     "type" "ProductType" NOT NULL DEFAULT 'other',
ADD COLUMN     "volumeMl" INTEGER,
ALTER COLUMN "wooId" DROP NOT NULL,
ALTER COLUMN "flavour" DROP NOT NULL,
ALTER COLUMN "puffs" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logoKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "key" TEXT,
    "sourceUrl" TEXT,
    "alt" TEXT NOT NULL DEFAULT '',
    "width" INTEGER,
    "height" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "productId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");

-- CreateIndex
CREATE INDEX "ProductImage_productId_position_idx" ON "ProductImage"("productId", "position");

-- CreateIndex
CREATE INDEX "ProductCategory_categoryId_position_idx" ON "ProductCategory"("categoryId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Category_wooId_key" ON "Category"("wooId");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE INDEX "Category_kind_sortOrder_idx" ON "Category"("kind", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_status_isFeatured_idx" ON "Product"("status", "isFeatured");

-- CreateIndex
CREATE INDEX "Product_type_status_idx" ON "Product"("type", "status");

-- CreateIndex
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

