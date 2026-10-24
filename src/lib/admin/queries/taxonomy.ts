import "server-only";
import { prisma } from "@/lib/db";
import { mediaUrl } from "@/lib/catalog";
import { requireAdmin } from "@/lib/admin/auth";
import type { CategoryKind, Prisma } from "@/generated/prisma/client";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const KINDS = ["type", "brand", "series", "collection"] as const;

export const CATEGORY_VIEWS = ["all", "visible", "hidden", "featured"] as const;
export type CategoryView = (typeof CATEGORY_VIEWS)[number];
export type CategoryListParams = { q: string; view: CategoryView; kind: CategoryKind | "" };

export function parseCategoryParams(sp: Record<string, string | string[] | undefined>): CategoryListParams {
  const view = first(sp.view);
  const kind = first(sp.kind);
  return {
    q: first(sp.q).trim().slice(0, 100),
    view: (CATEGORY_VIEWS as readonly string[]).includes(view) ? (view as CategoryView) : "all",
    kind: (KINDS as readonly string[]).includes(kind) ? (kind as CategoryKind) : "",
  };
}

export function categoryListHref(params: CategoryListParams, change: Partial<CategoryListParams>) {
  const next = { ...params, ...change };
  const qs = new URLSearchParams();
  if (next.q) qs.set("q", next.q);
  if (next.view !== "all") qs.set("view", next.view);
  if (next.kind) qs.set("kind", next.kind);
  const s = qs.toString();
  return s ? `/admin/categories?${s}` : "/admin/categories";
}

const VIEW_WHERE: Record<CategoryView, Prisma.CategoryWhereInput> = {
  all: {},
  visible: { isVisible: true },
  hidden: { isVisible: false },
  featured: { isFeatured: true },
};

/** All categories (there are dozens, not thousands), with counts for tiles and kind chips. */
export async function listAdminCategories(params: CategoryListParams) {
  await requireAdmin();
  const search: Prisma.CategoryWhereInput = params.q
    ? { OR: [{ name: { contains: params.q, mode: "insensitive" } }, { slug: { contains: params.q, mode: "insensitive" } }] }
    : {};
  const kindWhere: Prisma.CategoryWhereInput = params.kind ? { kind: params.kind } : {};

  const [rows, viewCounts, kindCounts] = await Promise.all([
    prisma.category.findMany({
      where: { AND: [search, kindWhere, VIEW_WHERE[params.view]] },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        kind: true,
        isVisible: true,
        isFeatured: true,
        sortOrder: true,
        imageKey: true,
        parent: { select: { name: true } },
        _count: { select: { products: true, children: true } },
      },
    }),
    Promise.all(CATEGORY_VIEWS.map((v) => prisma.category.count({ where: { AND: [search, kindWhere, VIEW_WHERE[v]] } }))),
    prisma.category.groupBy({ by: ["kind"], where: { AND: [search, VIEW_WHERE[params.view]] }, _count: { _all: true } }),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      kind: r.kind,
      isVisible: r.isVisible,
      isFeatured: r.isFeatured,
      sortOrder: r.sortOrder,
      image: r.imageKey ? mediaUrl(r.imageKey) : null,
      parent: r.parent?.name ?? null,
      products: r._count.products,
      children: r._count.children,
    })),
    viewCounts: Object.fromEntries(CATEGORY_VIEWS.map((v, i) => [v, viewCounts[i]])) as Record<CategoryView, number>,
    kindCounts: Object.fromEntries(kindCounts.map((k) => [k.kind, k._count._all])) as Partial<Record<CategoryKind, number>>,
  };
}

export type AdminCategoryRow = Awaited<ReturnType<typeof listAdminCategories>>["rows"][number];

/** Parent and brand options for the category editor. */
export async function categoryEditorOptions() {
  await requireAdmin();
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, parentId: true } }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { categories, brands };
}

export type CategoryEditorOptions = Awaited<ReturnType<typeof categoryEditorOptions>>;

export async function getAdminCategory(id: string) {
  await requireAdmin();
  const c = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true, children: true } } },
  });
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    kind: c.kind,
    tagline: c.tagline ?? "",
    description: c.description ?? "",
    parentId: c.parentId,
    brandId: c.brandId,
    isVisible: c.isVisible,
    isFeatured: c.isFeatured,
    sortOrder: c.sortOrder,
    imageKey: c.imageKey,
    metaTitle: c.metaTitle ?? "",
    metaDescription: c.metaDescription ?? "",
    products: c._count.products,
    children: c._count.children,
    updatedAt: c.updatedAt,
  };
}

export type AdminCategory = NonNullable<Awaited<ReturnType<typeof getAdminCategory>>>;

/** Brands with product and range counts. */
export async function listAdminBrands(q: string) {
  await requireAdmin();
  const rows = await prisma.brand.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }] } : {},
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      updatedAt: true,
      _count: { select: { products: true, categories: true } },
      products: { where: { status: "active" }, select: { id: true } },
    },
  });
  return rows.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    updatedAt: b.updatedAt,
    products: b._count.products,
    live: b.products.length,
    categories: b._count.categories,
  }));
}

export type AdminBrandRow = Awaited<ReturnType<typeof listAdminBrands>>[number];

export async function getAdminBrand(id: string) {
  await requireAdmin();
  const b = await prisma.brand.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      updatedAt: true,
      _count: { select: { products: true } },
      categories: { orderBy: { name: "asc" }, select: { id: true, name: true } },
    },
  });
  if (!b) return null;
  return { id: b.id, name: b.name, slug: b.slug, updatedAt: b.updatedAt, products: b._count.products, categories: b.categories };
}

export type AdminBrand = NonNullable<Awaited<ReturnType<typeof getAdminBrand>>>;
