"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/auth";
import { fail, ok, toActionError, type ActionResult } from "@/lib/admin/result";
import { refreshCatalog } from "@/lib/admin/revalidate";
import { brandSchema, categorySchema, fieldErrors, type BrandInput, type CategoryInput } from "@/lib/admin/schemas/taxonomy";
import type { DeleteOutcome } from "@/components/admin/ui/confirm-delete";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/** Walks up from the proposed parent; reaching the category itself would make a loop. */
async function parentError(id: string | null, parentId: string | null): Promise<string | null> {
  if (!parentId) return null;
  if (parentId === id) return "A category can't be inside itself.";
  const all = await prisma.category.findMany({ select: { id: true, parentId: true } });
  const parentOf = new Map(all.map((c) => [c.id, c.parentId]));
  if (!parentOf.has(parentId)) return "That parent category no longer exists.";
  let cursor: string | null | undefined = parentId;
  for (let depth = 0; cursor && depth < 50; depth++) {
    if (cursor === id) return "That would put the category inside one of its own sub-categories.";
    cursor = parentOf.get(cursor);
  }
  return null;
}

async function checkCategory(id: string | null, input: CategoryInput) {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { error: fail("Some fields need attention.", fieldErrors(parsed.error)) };
  const c = parsed.data;
  const [loop, brand] = await Promise.all([parentError(id, c.parentId), c.brandId ? prisma.brand.count({ where: { id: c.brandId } }) : Promise.resolve(1)]);
  const errors: Record<string, string> = {};
  if (loop) errors.parentId = loop;
  if (!brand) errors.brandId = "That brand no longer exists.";
  if (Object.keys(errors).length) return { error: fail("Some fields need attention.", errors) };
  return { data: c };
}

export async function createCategory(input: CategoryInput): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAdmin("catalog:write");
    const checked = await checkCategory(null, input);
    if (checked.error) return checked.error;
    const created = await prisma.category.create({ data: checked.data, select: { id: true } });
    refreshCatalog();
    return ok(created);
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateCategory(id: string, input: CategoryInput): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAdmin("catalog:write");
    const checked = await checkCategory(id, input);
    if (checked.error) return checked.error;
    const updated = await prisma.category.update({ where: { id }, data: { ...checked.data, needsReview: false }, select: { id: true } });
    refreshCatalog();
    return ok(updated);
  } catch (error) {
    return toActionError(error);
  }
}

/** Quick switches from the list: shown in the store, and featured on the homepage. */
export async function setCategoryFlag(id: string, flag: "isVisible" | "isFeatured", value: boolean): Promise<ActionResult> {
  try {
    await requireAdmin("catalog:write");
    if (flag !== "isVisible" && flag !== "isFeatured") return fail("Unknown setting.");
    await prisma.category.update({ where: { id }, data: { [flag]: Boolean(value) } });
    refreshCatalog();
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

/** Refuses while products or sub-categories are attached, and says exactly what's in the way. */
export async function deleteCategory(id: string): Promise<ActionResult<DeleteOutcome>> {
  try {
    await requireAdmin("catalog:delete");
    const c = await prisma.category.findUnique({ where: { id }, select: { name: true, _count: { select: { products: true, children: true } } } });
    if (!c) return fail("This category was already deleted.");
    const blockers = [c._count.products && plural(c._count.products, "product"), c._count.children && plural(c._count.children, "sub-category")].filter(Boolean);
    if (blockers.length) {
      return fail(`${c.name} still has ${blockers.join(" and ")}. Move ${blockers.length > 1 || c._count.products > 1 ? "them" : "it"} to another category first, or hide this category instead.`);
    }
    await prisma.category.delete({ where: { id } });
    refreshCatalog();
    return ok({ action: "deleted" });
  } catch (error) {
    return toActionError(error);
  }
}

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

export async function createBrand(input: BrandInput): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAdmin("catalog:write");
    const parsed = brandSchema.safeParse(input);
    if (!parsed.success) return fail("Some fields need attention.", fieldErrors(parsed.error));
    const created = await prisma.brand.create({ data: parsed.data, select: { id: true } });
    refreshCatalog();
    return ok(created);
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateBrand(id: string, input: BrandInput): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAdmin("catalog:write");
    const parsed = brandSchema.safeParse(input);
    if (!parsed.success) return fail("Some fields need attention.", fieldErrors(parsed.error));
    const updated = await prisma.brand.update({ where: { id }, data: parsed.data, select: { id: true } });
    refreshCatalog();
    return ok(updated);
  } catch (error) {
    return toActionError(error);
  }
}

/** A brand with products can't be deleted: the products would silently lose their brand. */
export async function deleteBrand(id: string): Promise<ActionResult<DeleteOutcome>> {
  try {
    await requireAdmin("catalog:delete");
    const b = await prisma.brand.findUnique({ where: { id }, select: { name: true, _count: { select: { products: true } } } });
    if (!b) return fail("This brand was already deleted.");
    if (b._count.products) {
      return fail(`${b.name} still has ${plural(b._count.products, "product")}. Give ${b._count.products === 1 ? "it" : "them"} another brand or delete ${b._count.products === 1 ? "it" : "them"} first.`);
    }
    await prisma.brand.delete({ where: { id } }); // its brand-range categories keep existing, unlinked
    refreshCatalog();
    return ok({ action: "deleted" });
  } catch (error) {
    return toActionError(error);
  }
}
