import "server-only";
import { prisma } from "@/lib/db";
import { mediaUrl } from "@/lib/catalog";
import { requireAdmin } from "@/lib/admin/auth";
import { PRODUCT_TYPES } from "@/lib/admin/schemas/product";
import type { Prisma, ProductType } from "@/generated/prisma/client";

export const PRODUCT_PAGE_SIZE = 50;

export const PRODUCT_VIEWS = ["all", "active", "draft", "archived", "out", "review"] as const;
export type ProductView = (typeof PRODUCT_VIEWS)[number];

export const PRODUCT_SORTS = [
  { value: "updated", label: "Recently edited" },
  { value: "name", label: "Name A-Z" },
  { value: "price-asc", label: "Price low to high" },
  { value: "price-desc", label: "Price high to low" },
] as const;
type ProductSort = (typeof PRODUCT_SORTS)[number]["value"];

export type ProductListParams = {
  q: string;
  view: ProductView;
  type: ProductType | "";
  brand: string;
  category: string;
  sort: ProductSort;
  page: number;
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Every incoming param is type-guarded; garbage falls back to the default. */
export function parseProductParams(sp: Record<string, string | string[] | undefined>): ProductListParams {
  const view = first(sp.view);
  const type = first(sp.type);
  const sort = first(sp.sort);
  const page = Number.parseInt(first(sp.page), 10);
  return {
    q: first(sp.q).trim().slice(0, 100),
    view: (PRODUCT_VIEWS as readonly string[]).includes(view) ? (view as ProductView) : "all",
    type: PRODUCT_TYPES.some((t) => t.value === type) ? (type as ProductType) : "",
    brand: /^[a-z0-9-]{1,120}$/.test(first(sp.brand)) ? first(sp.brand) : "",
    category: /^[a-z0-9-]{1,120}$/.test(first(sp.category)) ? first(sp.category) : "",
    sort: PRODUCT_SORTS.some((s) => s.value === sort) ? (sort as ProductSort) : "updated",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** Builds a list URL from the current params plus a change, dropping defaults to keep links clean. */
export function productListHref(params: ProductListParams, change: Partial<ProductListParams>) {
  const next = { ...params, page: 1, ...change };
  const qs = new URLSearchParams();
  if (next.q) qs.set("q", next.q);
  if (next.view !== "all") qs.set("view", next.view);
  if (next.type) qs.set("type", next.type);
  if (next.brand) qs.set("brand", next.brand);
  if (next.category) qs.set("category", next.category);
  if (next.sort !== "updated") qs.set("sort", next.sort);
  if (next.page > 1) qs.set("page", String(next.page));
  const s = qs.toString();
  return s ? `/admin/products?${s}` : "/admin/products";
}

const VIEW_WHERE: Record<ProductView, Prisma.ProductWhereInput> = {
  all: {},
  active: { status: "active" },
  draft: { status: "draft" },
  archived: { status: "archived" },
  out: { stockStatus: "out_of_stock" },
  review: { needsReview: true },
};

const ORDER_BY: Record<ProductSort, Prisma.ProductOrderByWithRelationInput[]> = {
  updated: [{ updatedAt: "desc" }, { id: "asc" }],
  name: [{ name: "asc" }],
  "price-asc": [{ priceCents: "asc" }, { name: "asc" }],
  "price-desc": [{ priceCents: "desc" }, { name: "asc" }],
};

function searchWhere(q: string): Prisma.ProductWhereInput | undefined {
  if (!q) return undefined;
  const contains = { contains: q, mode: "insensitive" as const };
  const or: Prisma.ProductWhereInput[] = [{ name: contains }, { slug: contains }, { flavour: contains }, { sku: contains }, { brand: { name: contains } }];
  if (/^\d{1,9}$/.test(q)) or.push({ wooId: Number(q) });
  return { OR: or };
}

/** One page of products plus every count the page shows, in a single parallel batch. */
export async function listAdminProducts(params: ProductListParams) {
  await requireAdmin();

  // Each count strips only its own dimension, so a tile never just echoes the tile you're on.
  const base: Prisma.ProductWhereInput[] = [];
  const search = searchWhere(params.q);
  if (search) base.push(search);
  if (params.brand) base.push({ brand: { slug: params.brand } });
  if (params.category) base.push({ categories: { some: { category: { slug: params.category } } } });
  const typeWhere: Prisma.ProductWhereInput = params.type ? { type: params.type } : {};

  const forViews: Prisma.ProductWhereInput = { AND: [...base, typeWhere] };
  const forTypes: Prisma.ProductWhereInput = { AND: [...base, VIEW_WHERE[params.view]] };
  const where: Prisma.ProductWhereInput = { AND: [...base, typeWhere, VIEW_WHERE[params.view]] };

  const [rows, total, viewCounts, typeCounts, brands, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: ORDER_BY[params.sort],
      skip: (params.page - 1) * PRODUCT_PAGE_SIZE,
      take: PRODUCT_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        status: true,
        stockStatus: true,
        priceCents: true,
        regularPriceCents: true,
        isFeatured: true,
        needsReview: true,
        updatedAt: true,
        brand: { select: { name: true } },
        images: { where: { key: { not: null } }, orderBy: { position: "asc" }, take: 1, select: { key: true, hasBackground: true } },
        categories: { where: { isPrimary: true }, take: 1, select: { category: { select: { name: true } } } },
      },
    }),
    prisma.product.count({ where }),
    Promise.all(PRODUCT_VIEWS.map((v) => prisma.product.count({ where: { AND: [forViews, VIEW_WHERE[v]] } }))),
    prisma.product.groupBy({ by: ["type"], where: forTypes, _count: { _all: true } }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } }),
    prisma.category.findMany({ orderBy: [{ kind: "asc" }, { name: "asc" }], select: { slug: true, name: true } }),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      type: r.type,
      status: r.status,
      stockStatus: r.stockStatus,
      price: r.priceCents / 100,
      compareAt: r.regularPriceCents > r.priceCents ? r.regularPriceCents / 100 : null,
      isFeatured: r.isFeatured,
      needsReview: r.needsReview,
      updatedAt: r.updatedAt,
      brand: r.brand?.name ?? null,
      category: r.categories[0]?.category.name ?? null,
      image: r.images[0]?.key ? mediaUrl(r.images[0].key) : null,
      imageFit: r.images[0]?.hasBackground ? ("cover" as const) : ("contain" as const),
    })),
    total,
    pageCount: Math.max(1, Math.ceil(total / PRODUCT_PAGE_SIZE)),
    viewCounts: Object.fromEntries(PRODUCT_VIEWS.map((v, i) => [v, viewCounts[i]])) as Record<ProductView, number>,
    typeCounts: Object.fromEntries(typeCounts.map((t) => [t.type, t._count._all])) as Partial<Record<ProductType, number>>,
    brands,
    categories,
  };
}

export type AdminProductRow = Awaited<ReturnType<typeof listAdminProducts>>["rows"][number];

/** Brands and categories for the editor's pickers. */
export async function productEditorOptions() {
  await requireAdmin();
  const [brands, categories] = await Promise.all([
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, slug: true, name: true } }),
    prisma.category.findMany({
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      select: { id: true, name: true, kind: true, parent: { select: { name: true } } },
    }),
  ]);
  return { brands, categories: categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind, parent: c.parent?.name ?? null })) };
}

export type ProductEditorOptions = Awaited<ReturnType<typeof productEditorOptions>>;

/** Everything the editor needs for one product, or null if it no longer exists. */
export async function getAdminProduct(id: string) {
  await requireAdmin();
  const p = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { position: "asc" } },
      categories: { orderBy: { position: "asc" }, select: { categoryId: true, isPrimary: true } },
      _count: { select: { orderItems: true } },
    },
  });
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    wooId: p.wooId,
    type: p.type,
    status: p.status,
    stockStatus: p.stockStatus,
    brandId: p.brandId,
    flavour: p.flavour ?? "",
    flavourFamily: p.flavourFamily,
    puffs: p.puffs,
    volumeMl: p.volumeMl,
    nicotineMg: p.nicotineMg === null ? null : Number(p.nicotineMg),
    packSize: p.packSize,
    priceCents: p.priceCents,
    compareAtCents: p.regularPriceCents > p.priceCents ? p.regularPriceCents : null,
    sku: p.sku ?? "",
    isFeatured: p.isFeatured,
    needsReview: p.needsReview,
    reviewNotes: p.reviewNotes,
    shortDescription: p.shortDescription ?? "",
    description: p.description ?? "",
    metaTitle: p.metaTitle ?? "",
    metaDescription: p.metaDescription ?? "",
    categoryIds: p.categories.map((c) => c.categoryId),
    primaryCategoryId: p.categories.find((c) => c.isPrimary)?.categoryId ?? null,
    images: p.images
      .filter((i) => i.key)
      .map((i) => ({ key: i.key!, alt: i.alt, hasBackground: i.hasBackground, width: i.width, height: i.height })),
    orderCount: p._count.orderItems,
    updatedAt: p.updatedAt,
  };
}

export type AdminProduct = NonNullable<Awaited<ReturnType<typeof getAdminProduct>>>;
