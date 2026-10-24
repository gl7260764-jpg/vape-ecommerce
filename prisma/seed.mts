// Seeds the catalog from the committed build output in prisma/data/catalog/
// (see scripts/catalog/). Upserts by slug, so it is safe to re-run.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env"; // CommonJS package: no named ESM exports
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type CategoryKind } from "../src/generated/prisma/client";

nextEnv.loadEnvConfig(process.cwd());

const DATA = path.join(process.cwd(), "prisma", "data", "catalog");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_UNPOOLED }),
});

type TaxonomyFile = {
  brands: { slug: string; name: string; sortOrder: number }[];
  categories: {
    wooId: number | null;
    slug: string;
    name: string;
    kind: CategoryKind;
    brand: string | null;
    parent: string | null;
    tagline: string | null;
    description: string | null;
    imageKey: string | null;
    imageSourceUrl: string | null;
    isVisible: boolean;
    isFeatured: boolean;
    sortOrder: number;
    needsReview: boolean;
    reviewNotes: string[];
  }[];
};

const readJson = async <T,>(file: string) => JSON.parse(await readFile(path.join(DATA, file), "utf8")) as T;

async function seedTaxonomy() {
  const { brands, categories } = await readJson<TaxonomyFile>("taxonomy.json");

  for (const b of brands) {
    await prisma.brand.upsert({
      where: { slug: b.slug },
      create: b,
      update: { name: b.name, sortOrder: b.sortOrder },
    });
  }
  const brandIds = new Map((await prisma.brand.findMany({ select: { id: true, slug: true } })).map((b) => [b.slug, b.id]));

  // Pass 1: rows. Pass 2: parent links, once every category exists.
  for (const c of categories) {
    const { brand, parent, ...fields } = c;
    void parent; // linked in pass 2
    const data = { ...fields, brandId: brand ? (brandIds.get(brand) ?? null) : null };
    await prisma.category.upsert({ where: { slug: c.slug }, create: data, update: data });
  }
  const categoryIds = new Map((await prisma.category.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]));
  for (const c of categories) {
    await prisma.category.update({
      where: { slug: c.slug },
      data: { parentId: c.parent ? (categoryIds.get(c.parent) ?? null) : null },
    });
  }
  console.log(`taxonomy: ${brands.length} brands, ${categories.length} categories`);
}

/** Starting delivery options. Created once; after that the admin dashboard owns them (never overwritten here). */
async function seedShipping() {
  const methods = [
    { code: "express", name: "Express shipping", description: "Priority dispatch and the fastest tracked delivery.", priceCents: 5000, sortOrder: 0 },
    { code: "standard", name: "Regular shipping", description: "Tracked delivery Australia-wide.", priceCents: 2000, sortOrder: 1 },
  ];
  for (const m of methods) {
    await prisma.shippingMethod.upsert({ where: { code: m.code }, create: m, update: {} });
  }
  console.log(`shipping: ${methods.length} methods (existing ones left as edited)`);
}

async function main() {
  await seedShipping();
  await seedTaxonomy();
  if (existsSync(path.join(DATA, "products.json"))) {
    const { seedProducts } = await import("./seed-products.mjs");
    await seedProducts(prisma);
  } else {
    console.log("products: prisma/data/catalog/products.json not built yet, skipped");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
