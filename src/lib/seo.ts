import type { Metadata } from "next";
import { formatPrice } from "@/lib/catalog";
import type { CategoryKind, ProductType } from "@/generated/prisma/client";

// Titles and descriptions for store pages, written for people searching from Australia ("iget bar australia",
// "alibarbar vape australia"). Each one is built from the page's own details (puffs, flavour, range, price),
// so no two read alike. A page title or meta description the owner writes in the admin always wins.

export const SITE_NAME = "Best Vape Shop Australia";
/** What the root layout's title template adds to every page that doesn't set an absolute title. */
export const TITLE_SUFFIX = ` | ${SITE_NAME}`;
/** Open Graph tags every page shares. The layout sets these for pages that don't call pageMetadata. */
export const OPEN_GRAPH = { siteName: SITE_NAME, locale: "en_AU", type: "website" } as const;

const MAX_TITLE = 60; // about as much as Google shows before cutting a title off
const DELIVERY = "Tracked delivery Australia-wide.";

// THC and CBD products are waiting on the owner's legal review (SEO audit, 27 Oct 2026), so they keep their
// plain name and summary rather than titles and descriptions aimed at Australian searches.
const UNDER_REVIEW_BRANDS = new Set(["muha-meds", "ace", "supreme-cbd"]);

/**
 * Title, description, canonical and the matching Open Graph tags for one page. A page's openGraph replaces
 * the layout's whole rather than merging with it, so the shared tags are repeated here.
 */
export function pageMetadata({ title, description, path, image }: { title: string | { absolute: string }; description?: string; path: string; image?: string | null }): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { ...OPEN_GRAPH, title: typeof title === "string" ? title : title.absolute, description, url: path, ...(image ? { images: [image] } : {}) },
  };
}

const thousands = (n: number) => new Intl.NumberFormat("en-AU").format(n);
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** The first title that fits in a search result, or the last when none do. */
const fit = (...titles: string[]) => titles.find((t) => t.length <= MAX_TITLE) ?? titles[titles.length - 1];
/** "IGET Bar" -> "IGET Bar Australia"; names that already say Australia are left alone. */
const inAustralia = (name: string) => (/australia/i.test(name) ? name : `${name} Australia`);

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export type ProductSeoInput = {
  name: string;
  type: ProductType;
  price: number;
  brand: { slug: string; name: string } | null;
  primary: { name: string; kind: CategoryKind } | null;
  puffs: number | null;
  volumeMl: number | null;
  nicotineMg: number | null;
  packSize: number;
  flavour: string | null;
  shortDescription: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
};

// What shoppers add to a product name when they search ("... disposable vape australia").
const TITLE_LABEL: Partial<Record<ProductType, string>> = {
  disposable: "Disposable Vape",
  bundle: "Bulk Buy",
  e_liquid: "E-Liquid",
  pod_kit: "Pod Kit",
  nicotine_pouch: "Nicotine Pouches",
};

// Cannabinoid liquids were also imported as plain e-liquids: they name CBD/CBG in the title or come in
// strengths no nicotine liquid has ("60ml (3000mg)"; nicotine tops out around 50mg).
const underReview = (p: Pick<ProductSeoInput, "type" | "brand" | "name" | "nicotineMg">) =>
  p.type === "cbd" ||
  UNDER_REVIEW_BRANDS.has(p.brand?.slug ?? "") ||
  /\b(cbd|cbg|cbn|thc|hhc|delta[- ]?[89])\b/i.test(p.name) ||
  (p.nicotineMg ?? 0) > 100;

// The importer guessed flavours from product names and about one in ten came out mangled ("Grape Peach By",
// "Peach-Jam-Geek- - -X-", "Flavour Custom Pack"), so a flavour is only used when it reads as plain words.
const cleanFlavour = (f: string | null) =>
  f && f.length <= 32 && /^[A-Za-z][A-Za-z' &-]*$/.test(f) && !/\s-|-\s|-$/.test(f) && !/\b(by|pack|bulk|box|custom|mixed|case|kit)\b/i.test(f) ? f : null;

/** The full <title> for a product page (no store-name suffix: Google shows the site name on its own line). */
export function productTitle(p: ProductSeoInput): string {
  if (p.metaTitle) return p.metaTitle;
  if (underReview(p)) return `${p.name}${TITLE_SUFFIX}`;
  if (/australia/i.test(p.name)) return p.name;
  // Accessories, coils and glass take their category's name ("Vape Accessories").
  const label = TITLE_LABEL[p.type] ?? (p.primary?.kind === "type" ? p.primary.name : null);
  // Skip the label when the name already says it ("... Nicotine Pouch - Mint", "Bulk Buy 20 Pack ...").
  const labelled = label && !p.name.toLowerCase().includes(label.split(" ")[0].toLowerCase()) ? [`${p.name} | ${label} Australia`] : [];
  return fit(...labelled, `${p.name} | Australia`);
}

/** The meta description: what the product is, its range, flavour and price, then delivery. */
export function productDescription(p: ProductSeoInput): string | null {
  if (p.metaDescription) return p.metaDescription;
  if (underReview(p)) return p.shortDescription;
  const price = formatPrice(p.price);
  // "from the IGET Bar range" names what people search for; the brand alone when there's no series.
  const range = p.primary?.kind === "series" ? ` from the ${p.primary.name} range` : p.brand ? ` from ${p.brand.name}` : "";
  const flavour = cleanFlavour(p.flavour) ? ` in ${p.flavour}` : "";
  const puffs = p.puffs ? `${thousands(p.puffs)}-puff ` : "";

  let lead: string;
  if (p.packSize > 1 && (p.type === "disposable" || p.type === "bundle" || p.type === "nicotine_pouch")) {
    const each = formatPrice(Math.round((p.price / p.packSize) * 100) / 100);
    const unit = p.type === "nicotine_pouch" ? "tin" : "vape";
    lead = `A ${p.packSize}-pack of ${puffs}${unit}s${range} for ${price}, ${each} a ${unit}.`;
  } else if (p.type === "disposable") {
    lead = `A ${puffs}disposable vape${range}${flavour}, ${price}.`;
  } else if (p.type === "e_liquid") {
    const strength = [p.volumeMl && `${p.volumeMl}ml`, p.nicotineMg && `${p.nicotineMg}mg`].filter(Boolean).join(" ");
    lead = capitalise(`${strength ? `${strength} ` : ""}e-liquid${range}${flavour}, ${price}.`);
  } else if (p.type === "pod_kit") {
    lead = `A pod kit${range}${p.puffs ? ` (${thousands(p.puffs)} puffs)` : ""}${flavour}, ${price}.`;
  } else if (p.type === "nicotine_pouch") {
    lead = `Nicotine pouches${range}${flavour}${p.nicotineMg ? `, ${p.nicotineMg}mg` : ""}, ${price}.`;
  } else {
    // Accessories, glassware and mixed bundles: the name says what it is, led by its category.
    lead = `${p.primary?.name ?? "Vape gear"}: ${p.name}, ${price}.`;
  }
  return `${lead} ${DELIVERY}`;
}

// ---------------------------------------------------------------------------
// Categories and brands
// ---------------------------------------------------------------------------

type ListingSeoInput = { name: string; count: number; fromPrice: number | null };

const products = (count: number) => `${thousands(count)} ${count === 1 ? "product" : "products"}`;
const from = (l: ListingSeoInput) => (l.fromPrice ? ` from ${formatPrice(l.fromPrice)}` : "");

/** Category pages: "IGET Bar Australia | Best Vape Shop Australia". */
export function categorySeo(c: ListingSeoInput & { tagline: string | null; brandSlug: string | null; metaTitle: string | null; metaDescription: string | null }) {
  if (UNDER_REVIEW_BRANDS.has(c.brandSlug ?? "")) return { title: c.metaTitle ?? c.name, description: c.metaDescription ?? c.tagline ?? undefined };
  return {
    title: c.metaTitle ?? inAustralia(c.name),
    description: c.metaDescription ?? `${c.tagline ? `${c.tagline} ` : ""}Shop ${products(c.count)}${from(c)}, with tracked delivery to every state and territory.`,
  };
}

/** Brand pages: "IGET Australia: Full Range", kept apart from the brand's own category page title. */
export function brandSeo(b: ListingSeoInput & { slug: string; ranges: string[] }) {
  if (UNDER_REVIEW_BRANDS.has(b.slug)) {
    return { title: `${b.name} vapes and accessories`, description: `Shop ${b.count} ${b.name} products, with filters for type, flavour and price.` };
  }
  const ranges = b.ranges.length ? ` Including ${b.ranges.slice(0, 3).join(", ")}.` : "";
  // Never just "<name> Australia": that's the title of the brand's own category page. The layout adds TITLE_SUFFIX.
  const titles = [`${inAustralia(b.name)}: Full Range`, `${b.name}: Full Range`];
  return {
    title: titles.find((t) => t.length + TITLE_SUFFIX.length <= MAX_TITLE) ?? titles[1],
    description: `All ${thousands(b.count)} ${b.name} ${b.count === 1 ? "product" : "products"} we stock${from(b) && `,${from(b)}`}, with tracked delivery Australia-wide.${ranges}`,
  };
}
