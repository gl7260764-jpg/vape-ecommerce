// Loads prisma/data/catalog/products.json into Product, ProductImage and ProductCategory.
// Upserts by live product ID; each product's images and category links are replaced.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { FlavourFamily, PrismaClient, ProductStatus, ProductType } from "../src/generated/prisma/client";

type ProductFile = {
  wooId: number;
  slug: string;
  name: string;
  sourceName: string | null;
  type: ProductType;
  status: ProductStatus;
  description: string | null;
  shortDescription: string;
  priceCents: number;
  regularPriceCents: number;
  isPurchasable: boolean;
  brand: string | null;
  flavour: string | null;
  flavourFamily: FlavourFamily | null;
  puffs: number | null;
  volumeMl: number | null;
  nicotineMg: number | null;
  packSize: number;
  isFeatured: boolean;
  needsReview: boolean;
  reviewNotes: string[];
  categories: { slug: string; isPrimary: boolean; position: number }[];
  images: { key: string; sourceUrl: string | null; alt: string; width: number; height: number; hasBackground: boolean; position: number }[];
}[];

export async function seedProducts(prisma: PrismaClient) {
  const all = JSON.parse(
    await readFile(path.join(process.cwd(), "prisma", "data", "catalog", "products.json"), "utf8")
  ) as ProductFile;
  // SEED_ONLY=853,2807 re-seeds just those live product IDs (handy for fixes and debugging).
  const only = process.env.SEED_ONLY?.split(",").map(Number);
  const products = only ? all.filter((p) => only.includes(p.wooId)) : all;

  const brandIds = new Map((await prisma.brand.findMany({ select: { id: true, slug: true } })).map((b) => [b.slug, b.id]));
  const categoryIds = new Map((await prisma.category.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]));

  let done = 0;
  const failed: { wooId: number; error: string }[] = [];
  const queue = [...products];

  // Retries cover transient network or connection errors over a long run.
  async function withRetry(p: ProductFile[number]) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await seedOne(p);
      } catch (error) {
        if (attempt >= 3) {
          const e = error as { code?: string; message?: string };
          failed.push({ wooId: p.wooId, error: `${e.code ?? ""} ${e.message?.split("\n").slice(-3).join(" ") ?? error}`.trim() });
          return;
        }
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }

  async function worker() {
    for (let p = queue.shift(); p; p = queue.shift()) {
      await withRetry(p);
      if (++done % 250 === 0) console.log(`  products ${done}/${products.length}`);
    }
  }

  async function seedOne(p: ProductFile[number]) {
    {
      const { brand, categories, images, ...fields } = p;
      const data = {
        ...fields,
        brandId: brand ? (brandIds.get(brand) ?? null) : null,
        publishedAt: p.status === "active" ? new Date() : null,
      };
      const { id } = await prisma.product.upsert({
        where: { wooId: p.wooId },
        create: data,
        update: { ...data, publishedAt: undefined },
        select: { id: true },
      });
      await prisma.$transaction([
        prisma.productImage.deleteMany({ where: { productId: id } }),
        prisma.productImage.createMany({ data: images.map((img) => ({ ...img, productId: id })) }),
        prisma.productCategory.deleteMany({ where: { productId: id } }),
        prisma.productCategory.createMany({
          data: categories
            .filter((c) => categoryIds.has(c.slug))
            .map((c) => ({ productId: id, categoryId: categoryIds.get(c.slug)!, isPrimary: c.isPrimary, position: c.position })),
        }),
      ]);
    }
  }

  await Promise.all(Array.from({ length: 6 }, worker));
  // Products that moved from draft to active (e.g. a price was confirmed) get a publish date now.
  await prisma.$executeRaw`UPDATE "Product" SET "publishedAt" = now() WHERE status = 'active' AND "publishedAt" IS NULL`;
  console.log(`products: ${products.length - failed.length} seeded, ${failed.length} failed`);
  for (const f of failed) console.error(`  failed ${f.wooId}: ${f.error}`);
  if (failed.length) process.exitCode = 1;
}
