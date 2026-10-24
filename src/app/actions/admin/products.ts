"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/auth";
import { fail, ok, toActionError, type ActionResult } from "@/lib/admin/result";
import { refreshCatalog } from "@/lib/admin/revalidate";
import { productErrors, productSchema, type ProductData, type ProductInput } from "@/lib/admin/schemas/product";
import type { DeleteOutcome } from "@/components/admin/ui/confirm-delete";
import type { Prisma } from "@/generated/prisma/client";

/** Alt text the operator didn't write: "<name>" for the cover, "<name>, photo 2" after. */
const altFor = (name: string, alt: string, index: number) => alt || (index === 0 ? name : `${name}, photo ${index + 1}`);

function scalarData(p: ProductData) {
  return {
    name: p.name,
    slug: p.slug,
    type: p.type,
    status: p.status,
    stockStatus: p.stockStatus,
    brandId: p.brandId,
    flavour: p.flavour,
    flavourFamily: p.flavourFamily,
    puffs: p.puffs,
    volumeMl: p.volumeMl,
    nicotineMg: p.nicotineMg,
    packSize: p.packSize,
    priceCents: p.priceCents,
    // A "was" price must be genuine and above the price; anything else means no strikethrough.
    regularPriceCents: p.compareAtCents && p.compareAtCents > p.priceCents ? p.compareAtCents : p.priceCents,
    isPurchasable: p.priceCents > 0,
    sku: p.sku,
    isFeatured: p.isFeatured,
    needsReview: p.needsReview,
    shortDescription: p.shortDescription,
    description: p.description,
    metaTitle: p.metaTitle,
    metaDescription: p.metaDescription,
  } satisfies Prisma.ProductUncheckedUpdateInput;
}

const imageRows = (p: ProductData) =>
  p.images.map((img, i) => ({ key: img.key, alt: altFor(p.name, img.alt, i), hasBackground: img.hasBackground, width: img.width, height: img.height, position: i }));

/** New links go to the end of each category's listing; existing links keep their place. */
async function categoryRows(tx: Prisma.TransactionClient, p: ProductData, existing: Map<string, number>) {
  const fresh = p.categoryIds.filter((id) => !existing.has(id));
  const maxes = fresh.length
    ? await tx.productCategory.groupBy({ by: ["categoryId"], where: { categoryId: { in: fresh } }, _max: { position: true } })
    : [];
  const nextPos = new Map(maxes.map((m) => [m.categoryId, (m._max.position ?? -1) + 1]));
  const primary = p.primaryCategoryId ?? p.categoryIds[0] ?? null;
  return p.categoryIds.map((categoryId) => ({
    categoryId,
    isPrimary: categoryId === primary,
    position: existing.get(categoryId) ?? nextPos.get(categoryId) ?? 0,
  }));
}

async function checkReferences(p: ProductData): Promise<Record<string, string> | null> {
  const [brand, categoryCount] = await Promise.all([
    p.brandId ? prisma.brand.count({ where: { id: p.brandId } }) : Promise.resolve(1),
    prisma.category.count({ where: { id: { in: p.categoryIds } } }),
  ]);
  const errors: Record<string, string> = {};
  if (!brand) errors.brandId = "That brand no longer exists. Pick another.";
  if (categoryCount !== new Set(p.categoryIds).size) errors.categoryIds = "One of the categories no longer exists. Refresh and pick again.";
  return Object.keys(errors).length ? errors : null;
}

export async function createProduct(input: ProductInput): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    await requireAdmin("catalog:write");
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) return fail("Some fields need attention.", productErrors(parsed.error));
    const p = parsed.data;
    const refErrors = await checkReferences(p);
    if (refErrors) return fail("Some fields need attention.", refErrors);

    const created = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: { ...scalarData(p), publishedAt: p.status === "active" ? new Date() : null, images: { create: imageRows(p) } },
        select: { id: true, slug: true },
      });
      const links = await categoryRows(tx, p, new Map());
      if (links.length) await tx.productCategory.createMany({ data: links.map((l) => ({ ...l, productId: product.id })) });
      return product;
    });

    refreshCatalog(created.slug);
    return ok(created);
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateProduct(id: string, input: ProductInput): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    await requireAdmin("catalog:write");
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) return fail("Some fields need attention.", productErrors(parsed.error));
    const p = parsed.data;

    const current = await prisma.product.findUnique({
      where: { id },
      select: { slug: true, publishedAt: true, reviewNotes: true, categories: { select: { categoryId: true, position: true } } },
    });
    if (!current) return fail("This product was deleted. Go back to the product list.");
    const refErrors = await checkReferences(p);
    if (refErrors) return fail("Some fields need attention.", refErrors);

    const updated = await prisma.$transaction(async (tx) => {
      const links = await categoryRows(tx, p, new Map(current.categories.map((c) => [c.categoryId, c.position])));
      // Children are replaced in place: simplest correct way to apply reorders, removals and additions.
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.productCategory.deleteMany({ where: { productId: id } });
      const product = await tx.product.update({
        where: { id },
        data: {
          ...scalarData(p),
          publishedAt: current.publishedAt ?? (p.status === "active" ? new Date() : null),
          reviewNotes: p.needsReview ? current.reviewNotes : [],
          images: { create: imageRows(p) },
        },
        select: { id: true, slug: true },
      });
      if (links.length) await tx.productCategory.createMany({ data: links.map((l) => ({ ...l, productId: id })) });
      return product;
    });

    refreshCatalog(current.slug, updated.slug);
    return ok(updated);
  } catch (error) {
    return toActionError(error);
  }
}

/** Products in past orders are archived (hidden, history intact); others are deleted with their links and photos. */
export async function deleteProduct(id: string): Promise<ActionResult<DeleteOutcome>> {
  try {
    await requireAdmin("catalog:delete");
    const product = await prisma.product.findUnique({ where: { id }, select: { slug: true, _count: { select: { orderItems: true } } } });
    if (!product) return fail("This product was already deleted.");

    if (product._count.orderItems > 0) {
      await prisma.product.update({ where: { id }, data: { status: "archived", isFeatured: false } });
      refreshCatalog(product.slug);
      return ok({ action: "archived" });
    }
    await prisma.product.delete({ where: { id } }); // images and category links cascade
    refreshCatalog(product.slug);
    return ok({ action: "deleted" });
  } catch (error) {
    return toActionError(error);
  }
}
