import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/db";
import { mediaUrl, type Category, type Product } from "@/lib/catalog";
import { PAGE_SIZE, PRICE_BANDS, type Filters, type Sort } from "@/lib/filters";
import { cleanDescription } from "@/lib/sanitize";
import type { FlavourFamily, Prisma, ProductType } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

/** Fields every product card needs: primary image and primary category for the line label. */
export const cardSelect = {
  wooId: true,
  slug: true,
  name: true,
  type: true,
  packSize: true,
  flavour: true,
  flavourFamily: true,
  puffs: true,
  priceCents: true,
  regularPriceCents: true,
  images: { select: { key: true, hasBackground: true }, where: { key: { not: null } }, orderBy: { position: "asc" }, take: 1 },
  categories: { select: { category: { select: { name: true, kind: true } } }, where: { isPrimary: true }, take: 1 },
} satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

/** "HQD Cuvie Slick 20000" -> "HQD Cuvie Slick": the puff count is shown separately on the card. */
const lineLabel = (name: string | undefined) => (name ?? "").replace(/\s+\d[\d,]*(\s*puffs)?$/i, "");

export function toCard(row: CardRow): Product {
  const primary = row.categories[0]?.category;
  // Single bars and pouches in a series read best as just the flavour ("Banana Ice", line "IGET Bar").
  // Everything else (packs, e-liquids, accessories) keeps its full name.
  const flavourTitle =
    Boolean(row.flavour) && row.packSize === 1 && primary?.kind === "series" && (row.type === "disposable" || row.type === "nicotine_pouch");
  return {
    id: String(row.wooId),
    slug: row.slug,
    flavour: flavourTitle ? row.flavour! : row.name,
    line: lineLabel(primary?.name),
    puffs: row.puffs,
    price: row.priceCents / 100,
    compareAt: row.regularPriceCents / 100,
    image: row.images[0]?.key ? mediaUrl(row.images[0].key) : "",
    imageFit: row.images[0]?.hasBackground ? "cover" : "contain",
    family: row.flavourFamily,
  };
}

const live = { status: "active" } satisfies Prisma.ProductWhereInput;

// ---------------------------------------------------------------------------
// Homepage
// ---------------------------------------------------------------------------

/** Active products with a photo in one category, in the store's listing order. */
async function inCategory(slug: string, take: number) {
  const links = await prisma.productCategory.findMany({
    where: { category: { slug }, product: { ...live, images: { some: { key: { not: null } } } } },
    orderBy: { position: "asc" },
    select: { product: { select: cardSelect } },
    take,
  });
  return links.map((link) => toCard(link.product));
}

/**
 * Everything the homepage shows, read from Postgres. Cached and tagged "catalog",
 * so a product edit can call revalidateTag("catalog") instead of waiting out the hour.
 */
export async function getHomeCatalog() {
  "use cache";
  cacheTag("catalog");
  cacheLife("hours");

  const [iget, hqd, categoryRows] = await Promise.all([
    inCategory("iget-bar-australia", 8),
    inCategory("hqd-cuvie-slick-20000", 8),
    prisma.category.findMany({
      where: { isFeatured: true, isVisible: true },
      orderBy: { sortOrder: "asc" },
      select: { slug: true, name: true, tagline: true, imageKey: true, _count: { select: { products: { where: { product: live } } } } },
    }),
  ]);

  const categories: Category[] = categoryRows.map((row) => ({
    slug: row.slug,
    name: row.name,
    count: row._count.products,
    blurb: row.tagline ?? "",
    image: row.imageKey ? mediaUrl(row.imageKey) : "",
  }));

  const featured = [...iget, ...hqd];
  const flavourNames = Array.from(new Set(featured.map((p) => p.flavour.replace(/\s*Christmas Edition$/i, ""))));

  return { iget, hqd, featured, categories, flavourNames };
}

// ---------------------------------------------------------------------------
// Listings (shop, category, brand)
// ---------------------------------------------------------------------------

export type ListingScope = { category?: string; brand?: string };

/** A category listing includes its sub-categories (Alibarbar includes Pandora, Upload and Ingot). */
function scopeWhere(scope: ListingScope): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { ...live };
  if (scope.category) {
    where.categories = { some: { category: { OR: [{ slug: scope.category }, { parent: { slug: scope.category } }] } } };
  }
  if (scope.brand) where.brand = { slug: scope.brand };
  return where;
}

const priceWhere = (value: string): Prisma.ProductWhereInput => {
  const band = PRICE_BANDS.find((b) => b.value === value)!;
  return { priceCents: band.max === null ? { gte: band.min } : { gte: band.min, lte: band.max } };
};

function filterWhere(f: Filters): Prisma.ProductWhereInput[] {
  const and: Prisma.ProductWhereInput[] = [];
  if (f.brand.length) and.push({ brand: { slug: { in: f.brand } } });
  if (f.type.length) and.push({ type: { in: f.type as ProductType[] } });
  if (f.family.length) and.push({ flavourFamily: { in: f.family as FlavourFamily[] } });
  if (f.price) and.push(priceWhere(f.price));
  return and;
}

const ORDER: Record<Sort, Prisma.ProductOrderByWithRelationInput[]> = {
  // Featured = clean studio photos first (isFeatured is set by the catalog build), newest within that.
  featured: [{ isFeatured: "desc" }, { wooId: "desc" }],
  newest: [{ wooId: "desc" }],
  "price-asc": [{ priceCents: "asc" }, { wooId: "desc" }],
  "price-desc": [{ priceCents: "desc" }, { wooId: "desc" }],
  name: [{ name: "asc" }],
};

export type Facet = { value: string; label?: string; count: number };

/**
 * One page of products for a scope and filter state, plus facet counts for the scope.
 * Facets count the whole scope (not the current filters) so options never vanish while browsing.
 */
export async function listProducts(scope: ListingScope, filters: Filters) {
  "use cache";
  cacheTag("catalog");
  cacheLife("hours");

  const base = scopeWhere(scope);
  const where: Prisma.ProductWhereInput = { AND: [base, ...filterWhere(filters)] };

  const [total, brandGroups, typeGroups, familyGroups, priceCounts] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.groupBy({ by: ["brandId"], where: { AND: [base, { brandId: { not: null } }] }, _count: { _all: true } }),
    prisma.product.groupBy({ by: ["type"], where: base, _count: { _all: true } }),
    prisma.product.groupBy({ by: ["flavourFamily"], where: { AND: [base, { flavourFamily: { not: null } }] }, _count: { _all: true } }),
    Promise.all(PRICE_BANDS.map((b) => prisma.product.count({ where: { AND: [base, priceWhere(b.value)] } }))),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const rows = await prisma.product.findMany({
    where,
    orderBy: ORDER[filters.sort],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: cardSelect,
  });

  const brandRows = await prisma.brand.findMany({
    where: { id: { in: brandGroups.map((g) => g.brandId!).filter(Boolean) } },
    select: { id: true, slug: true, name: true },
  });
  const brandById = new Map(brandRows.map((b) => [b.id, b]));

  return {
    items: rows.map(toCard),
    total,
    page,
    pageCount,
    facets: {
      brands: brandGroups
        .map((g) => ({ value: brandById.get(g.brandId!)!.slug, label: brandById.get(g.brandId!)!.name, count: g._count._all }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
      types: typeGroups.map((g) => ({ value: g.type as string, count: g._count._all })).sort((a, b) => b.count - a.count),
      families: familyGroups.map((g) => ({ value: g.flavourFamily as string, count: g._count._all })).sort((a, b) => b.count - a.count),
      prices: PRICE_BANDS.map((b, i) => ({ value: b.value as string, label: b.label as string, count: priceCounts[i] })),
    },
  };
}

export type Listing = Awaited<ReturnType<typeof listProducts>>;

// ---------------------------------------------------------------------------
// Category, brand and product pages
// ---------------------------------------------------------------------------

export async function getCategory(slug: string) {
  "use cache";
  cacheTag("catalog");
  cacheLife("hours");

  const c = await prisma.category.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      kind: true,
      tagline: true,
      description: true,
      imageKey: true,
      isVisible: true,
      metaTitle: true,
      metaDescription: true,
      parent: { select: { slug: true, name: true } },
      brand: { select: { slug: true, name: true } },
      children: { where: { isVisible: true }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } },
    },
  });
  if (!c || !c.isVisible) return null;
  const count = await prisma.product.count({ where: scopeWhere({ category: slug }) });
  return {
    ...c,
    image: c.imageKey ? mediaUrl(c.imageKey) : null,
    description: cleanDescription(c.description),
    count,
  };
}

export async function getBrand(slug: string) {
  "use cache";
  cacheTag("catalog");
  cacheLife("hours");

  const b = await prisma.brand.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      categories: {
        where: { isVisible: true },
        orderBy: { sortOrder: "asc" },
        select: { slug: true, name: true, tagline: true, imageKey: true, kind: true },
      },
    },
  });
  if (!b) return null;
  const count = await prisma.product.count({ where: scopeWhere({ brand: slug }) });
  if (!count) return null;
  const cover = await prisma.productImage.findFirst({
    where: { key: { not: null }, product: { ...live, brand: { slug } } },
    orderBy: { product: { wooId: "desc" } },
    select: { key: true },
  });
  return {
    ...b,
    count,
    image: b.categories.find((c) => c.imageKey)?.imageKey ?? cover?.key ?? null,
    categories: b.categories.map((c) => ({ ...c, image: c.imageKey ? mediaUrl(c.imageKey) : null })),
  };
}

/** Every visible category with its live product count (sub-categories included), grouped by kind. */
export async function getCategories() {
  "use cache";
  cacheTag("catalog");
  cacheLife("hours");

  const rows = await prisma.category.findMany({
    where: { isVisible: true },
    orderBy: { sortOrder: "asc" },
    select: { slug: true, name: true, kind: true, tagline: true, imageKey: true },
  });
  const counts = await Promise.all(rows.map((c) => prisma.product.count({ where: scopeWhere({ category: c.slug }) })));
  const all = rows
    .map((c, i) => ({ slug: c.slug, name: c.name, kind: c.kind, tagline: c.tagline, image: c.imageKey ? mediaUrl(c.imageKey) : null, count: counts[i] }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);
  return {
    types: all.filter((c) => c.kind === "type"),
    ranges: all.filter((c) => c.kind === "series" || c.kind === "brand"),
    collections: all.filter((c) => c.kind === "collection"),
    total: all.length,
  };
}

/** Every brand with live products, biggest first, each with a cover photo. */
export async function getBrands() {
  "use cache";
  cacheTag("catalog");
  cacheLife("hours");

  const rows = await prisma.brand.findMany({
    select: {
      slug: true,
      name: true,
      _count: { select: { products: { where: live } } },
      categories: { where: { isVisible: true, imageKey: { not: null } }, orderBy: { sortOrder: "asc" }, select: { imageKey: true }, take: 1 },
      products: {
        where: { ...live, images: { some: { key: { not: null } } } },
        orderBy: { wooId: "desc" },
        select: { images: { where: { key: { not: null } }, orderBy: { position: "asc" }, select: { key: true }, take: 1 } },
        take: 1,
      },
    },
  });
  return rows
    .filter((b) => b._count.products > 0)
    .map((b) => {
      const key = b.categories[0]?.imageKey ?? b.products[0]?.images[0]?.key ?? null;
      return { slug: b.slug, name: b.name, count: b._count.products, image: key ? mediaUrl(key) : null };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export async function getProduct(slug: string) {
  "use cache";
  cacheTag("catalog", `product:${slug}`);
  cacheLife("hours");

  const p = await prisma.product.findUnique({
    where: { slug },
    select: {
      ...cardSelect,
      id: true,
      type: true,
      status: true,
      description: true,
      shortDescription: true,
      volumeMl: true,
      nicotineMg: true,
      packSize: true,
      metaTitle: true,
      metaDescription: true,
      brand: { select: { slug: true, name: true } },
      images: { where: { key: { not: null } }, orderBy: { position: "asc" }, select: { key: true, alt: true, width: true, height: true, hasBackground: true } },
      categories: {
        orderBy: { isPrimary: "desc" },
        select: {
          isPrimary: true,
          category: { select: { id: true, slug: true, name: true, kind: true, parent: { select: { slug: true, name: true } } } },
        },
      },
    },
  });
  if (!p || p.status !== "active") return null;

  const primary = p.categories.find((c) => c.isPrimary)?.category ?? p.categories[0]?.category ?? null;
  const related = primary
    ? await prisma.product.findMany({
        where: { ...live, id: { not: p.id }, images: { some: { key: { not: null } } }, categories: { some: { categoryId: primary.id } } },
        orderBy: { wooId: "desc" },
        select: cardSelect,
        take: 8,
      })
    : [];

  return {
    card: toCard({ ...p, images: p.images.slice(0, 1), categories: primary ? [{ category: { name: primary.name, kind: primary.kind } }] : [] }),
    name: p.name,
    type: p.type,
    brand: p.brand,
    primary,
    categories: p.categories.map((c) => c.category),
    images: p.images.map((img) => ({ src: mediaUrl(img.key!), alt: img.alt, width: img.width, height: img.height, fill: img.hasBackground })),
    shortDescription: p.shortDescription,
    description: cleanDescription(p.description),
    specs: {
      puffs: p.puffs,
      volumeMl: p.volumeMl,
      nicotineMg: p.nicotineMg ? Number(p.nicotineMg) : null,
      packSize: p.packSize,
      flavour: p.flavour,
      family: p.flavourFamily,
    },
    metaTitle: p.metaTitle,
    metaDescription: p.metaDescription,
    related: related.map(toCard),
  };
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProduct>>>;

// Build-time lists for generateStaticParams (not cached: they run once per build).
export const allProductSlugs = () => prisma.product.findMany({ where: live, select: { slug: true } });
export const allCategorySlugs = () => prisma.category.findMany({ where: { isVisible: true }, select: { slug: true } });
export const allBrandSlugs = () => prisma.brand.findMany({ where: { products: { some: live } }, select: { slug: true } });

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/** Header search: active products matching name, flavour or brand. */
export async function searchProducts(query: string, take = 8): Promise<Product[]> {
  const q = query.trim().slice(0, 80);
  if (!q) return [];
  const rows = await prisma.product.findMany({
    where: {
      ...live,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { flavour: { contains: q, mode: "insensitive" } },
        { brand: { name: { contains: q, mode: "insensitive" } } },
      ],
    },
    orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
    select: cardSelect,
    take,
  });
  return rows.map(toCard);
}
