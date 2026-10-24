// Category and brand rules shared by the editors and the server actions.
import { z } from "zod";
import { SLUG_PATTERN, slugify } from "@/lib/admin/slug";

export const CATEGORY_KINDS = [
  { value: "type", label: "Product type", hint: "E-liquids, accessories, glassware" },
  { value: "brand", label: "Brand range", hint: "Everything from one brand, like Alibarbar" },
  { value: "series", label: "Series", hint: "One product line, like IGET Bar Plus" },
  { value: "collection", label: "Collection", hint: "A curated set, like Bulk Buy" },
] as const;

export const kindLabel = (kind: string) => CATEGORY_KINDS.find((k) => k.value === kind)?.label ?? kind;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .transform((v) => v || null);

const slugField = z
  .string()
  .transform((v) => slugify(v))
  .pipe(z.string().min(2, "Add a web address").max(120).regex(SLUG_PATTERN, "Use lowercase letters, numbers and dashes"));

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Give the category a name").max(120, "Keep the name under 120 characters"),
  slug: slugField,
  kind: z.enum(["type", "brand", "series", "collection"], "Choose what kind of category this is"),
  tagline: optionalText(160),
  description: optionalText(30_000),
  parentId: z.string().nullable(),
  brandId: z.string().nullable(),
  isVisible: z.boolean(),
  isFeatured: z.boolean(),
  sortOrder: z.number().int("Use a whole number").min(-9999).max(9999),
  imageKey: z
    .string()
    .regex(/^(categories|products)\/[a-z0-9-]+\.(png|jpe?g|webp)$/, "That image isn't from the uploader")
    .nullable(),
  metaTitle: optionalText(120),
  metaDescription: optionalText(320),
});

export type CategoryInput = z.input<typeof categorySchema>;

export const brandSchema = z.object({
  name: z.string().trim().min(1, "Give the brand a name").max(80, "Keep the name under 80 characters"),
  slug: slugField,
});

export type BrandInput = z.input<typeof brandSchema>;

/** First message per top-level field. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0] ?? "form")] ??= issue.message;
  return out;
}
