// Product rules shared by the editor (instant feedback) and the server actions (the real check).
import { z } from "zod";
import { SLUG_PATTERN, slugify } from "@/lib/admin/slug";

export const PRODUCT_TYPES = [
  { value: "disposable", label: "Disposable vape" },
  { value: "e_liquid", label: "E-liquid" },
  { value: "pod_kit", label: "Pod kit" },
  { value: "nicotine_pouch", label: "Nicotine pouch" },
  { value: "accessory", label: "Accessory" },
  { value: "glassware", label: "Glassware" },
  { value: "cbd", label: "CBD" },
  { value: "bundle", label: "Bundle or bulk pack" },
  { value: "other", label: "Other" },
] as const;

export const PRODUCT_STATUSES = [
  { value: "active", label: "Live", hint: "Shown in the store and can be bought." },
  { value: "draft", label: "Draft", hint: "Hidden from the store while you work on it." },
  { value: "archived", label: "Archived", hint: "Hidden from the store, kept for past orders." },
] as const;

export const STOCK_STATUSES = [
  { value: "in_stock", label: "In stock" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "on_backorder", label: "On backorder" },
] as const;

export const FLAVOUR_FAMILIES = [
  { value: "iced", label: "Iced" },
  { value: "fruit", label: "Fruit" },
  { value: "dessert", label: "Dessert" },
  { value: "tobacco", label: "Tobacco" },
  { value: "mint", label: "Mint" },
  { value: "drink", label: "Drink" },
] as const;

const values = <T extends readonly { value: string }[]>(list: T) => list.map((o) => o.value) as unknown as [T[number]["value"], ...T[number]["value"][]];

/** Keys the editor may attach: uploaded product photos only. */
const IMAGE_KEY = /^products\/[a-z0-9-]+\.(png|jpe?g|webp)$/;

const optionalText = (max: number, message?: string) =>
  z
    .string()
    .trim()
    .max(max, message ?? `Keep this under ${max} characters`)
    .transform((v) => v || null);

const optionalInt = (min: number, max: number, label: string) =>
  z
    .number()
    .int(`${label} must be a whole number`)
    .min(min, `${label} can't be below ${min}`)
    .max(max, `${label} looks too high`)
    .nullable();

export const productImageSchema = z.object({
  key: z.string().regex(IMAGE_KEY, "That image isn't from the uploader"),
  alt: z.string().trim().max(200),
  hasBackground: z.boolean(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
});

export const productSchema = z
  .object({
    name: z.string().trim().min(2, "Give the product a name").max(200, "Keep the name under 200 characters"),
    slug: z
      .string()
      .transform((v) => slugify(v))
      .pipe(z.string().min(2, "Add a web address").max(120).regex(SLUG_PATTERN, "Use lowercase letters, numbers and dashes")),
    type: z.enum(values(PRODUCT_TYPES), "Choose a product type"),
    status: z.enum(values(PRODUCT_STATUSES), "Choose a status"),
    stockStatus: z.enum(values(STOCK_STATUSES), "Choose a stock status"),
    brandId: z.string().nullable(),
    flavour: optionalText(120),
    flavourFamily: z.enum(values(FLAVOUR_FAMILIES)).nullable(),
    puffs: optionalInt(0, 200_000, "Puffs"),
    volumeMl: optionalInt(0, 10_000, "Volume"),
    nicotineMg: z.number().min(0, "Nicotine can't be negative").max(100, "Nicotine looks too high").nullable(),
    packSize: z.number().int("Pack size must be a whole number").min(1, "Pack size is at least 1").max(1000, "Pack size looks too high"),
    priceCents: z.number().int().min(0, "Price can't be negative").max(10_000_000, "Price looks too high"),
    compareAtCents: z.number().int().min(0).max(10_000_000).nullable(),
    sku: optionalText(64),
    isFeatured: z.boolean(),
    needsReview: z.boolean(),
    shortDescription: optionalText(500),
    description: optionalText(30_000, "The description is too long"),
    metaTitle: optionalText(120),
    metaDescription: optionalText(320),
    categoryIds: z.array(z.string()).max(25, "Pick at most 25 categories"),
    primaryCategoryId: z.string().nullable(),
    images: z.array(productImageSchema).max(12, "Use at most 12 photos"),
  })
  .superRefine((p, ctx) => {
    if (p.status === "active" && p.priceCents <= 0) {
      ctx.addIssue({ code: "custom", path: ["priceCents"], message: "Set a price before making the product live" });
    }
    if (p.primaryCategoryId && !p.categoryIds.includes(p.primaryCategoryId)) {
      ctx.addIssue({ code: "custom", path: ["primaryCategoryId"], message: "The main category must be one of the ticked categories" });
    }
  });

export type ProductInput = z.input<typeof productSchema>;
export type ProductData = z.output<typeof productSchema>;
export type ProductImageInput = z.input<typeof productImageSchema>;

/** First message per field, keyed by the top-level field name. */
export function productErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

/** "$1,234.50" -> 123450. Blank -> null. Operators type dollars; the form keeps cents. */
export function dollarsToCents(input: string): number | null {
  const clean = input.replace(/[^\d.]/g, "");
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export const centsToDollars = (cents: number | null) => (cents === null ? "" : (cents / 100).toFixed(2));
