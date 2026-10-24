// Shared catalog types and formatters (safe for client components).
// The data itself lives in Neon Postgres; see src/lib/catalog-queries.ts.

export type FlavourFamily = "iced" | "fruit" | "dessert" | "tobacco" | "mint" | "drink";

export type Product = {
  id: string;
  slug: string;
  flavour: string;
  line: string;
  puffs: number | null;
  price: number;
  compareAt: number;
  image: string; // empty when the product has no photo
  /** "cover" for photos that kept their own backdrop, "contain" for padded cutouts. */
  imageFit?: "cover" | "contain";
  family: FlavourFamily | null;
};

export type Category = {
  slug: string;
  name: string;
  count: number;
  image: string;
  blurb: string;
};

/** Public URL for an object in the Neon assets bucket (served by app/media/[...key]). */
export const mediaUrl = (key: string) => `/media/${key}`;

export const formatPrice = (value: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(value);

export const formatPuffs = (value: number) =>
  `${new Intl.NumberFormat("en-AU").format(value)} puffs`;

/** "IGET Bar · 3,500 puffs", or just the line when the puff count is unknown. */
export const productMeta = (p: Pick<Product, "line" | "puffs">) =>
  [p.line, p.puffs ? formatPuffs(p.puffs) : null].filter(Boolean).join(" · ");
