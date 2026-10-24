// Listing filters live in the URL (?brand=iget&type=disposable&price=25-50&sort=price-asc&page=2),
// so every filtered view is shareable and crawlable. Shared by server queries and client controls.

export const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price, low to high" },
  { value: "price-desc", label: "Price, high to low" },
  { value: "name", label: "Name, A to Z" },
] as const;
export type Sort = (typeof SORTS)[number]["value"];

export const PRICE_BANDS = [
  { value: "under-25", label: "Under $25", min: 0, max: 2499 },
  { value: "25-50", label: "$25 to $50", min: 2500, max: 5000 },
  { value: "50-100", label: "$50 to $100", min: 5001, max: 10000 },
  { value: "100-plus", label: "Over $100", min: 10001, max: null },
] as const;
export type PriceBand = (typeof PRICE_BANDS)[number]["value"];

export const TYPE_LABELS: Record<string, string> = {
  disposable: "Disposables",
  bundle: "Bundles and packs",
  e_liquid: "E-liquids",
  pod_kit: "Pod kits and devices",
  nicotine_pouch: "Nicotine pouches",
  accessory: "Accessories",
  glassware: "Glassware",
  cbd: "CBD",
  other: "Other",
};

export const FAMILY_LABELS: Record<string, string> = {
  iced: "Iced",
  fruit: "Fruit",
  dessert: "Dessert",
  mint: "Mint and menthol",
  drink: "Drinks",
  tobacco: "Tobacco",
};

export const PAGE_SIZE = 24;

export type Filters = {
  brand: string[];
  type: string[];
  family: string[];
  price: PriceBand | null;
  sort: Sort;
  page: number;
};

type Raw = Record<string, string | string[] | undefined>;

const list = (v: string | string[] | undefined, allowed?: (s: string) => boolean) =>
  (Array.isArray(v) ? v : (v ?? "").split(","))
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s && /^[a-z0-9_-]{1,60}$/.test(s) && (!allowed || allowed(s)))
    .slice(0, 20)
    .sort();

export function parseFilters(raw: Raw): Filters {
  const one = (k: string) => (Array.isArray(raw[k]) ? raw[k]![0] : raw[k]) ?? "";
  const sort = SORTS.find((s) => s.value === one("sort"))?.value ?? "featured";
  const price = PRICE_BANDS.find((p) => p.value === one("price"))?.value ?? null;
  const page = Math.min(Math.max(Number.parseInt(one("page"), 10) || 1, 1), 500);
  return {
    brand: list(raw.brand),
    type: list(raw.type, (s) => s in TYPE_LABELS),
    family: list(raw.family, (s) => s in FAMILY_LABELS),
    price,
    sort,
    page,
  };
}

/** Builds the query string for a filter state; defaults are omitted to keep URLs short. */
export function toQuery(f: Partial<Filters>) {
  const q = new URLSearchParams();
  if (f.brand?.length) q.set("brand", f.brand.join(","));
  if (f.type?.length) q.set("type", f.type.join(","));
  if (f.family?.length) q.set("family", f.family.join(","));
  if (f.price) q.set("price", f.price);
  if (f.sort && f.sort !== "featured") q.set("sort", f.sort);
  if (f.page && f.page > 1) q.set("page", String(f.page));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const activeFilterCount = (f: Filters) => f.brand.length + f.type.length + f.family.length + (f.price ? 1 : 0);
