import type { Metadata } from "next";
import { formatPrice } from "@/lib/catalog";
import { CONTACT_EMAIL, CONTACT_PHONE, SITE_URL } from "@/lib/site";
import type { CategoryKind, ProductType } from "@/generated/prisma/client";

// Titles and descriptions for store pages, written for people searching from Australia ("iget bar australia",
// "alibarbar vape australia"). Each one is built from the page's own details (puffs, flavour, range, price),
// so no two read alike. A page title or meta description the owner writes in the admin always wins.

export const SITE_NAME = "Best Vape Shop Australia";
/** What the root layout's title template adds to every page that doesn't set an absolute title. */
export const TITLE_SUFFIX = ` | ${SITE_NAME}`;
/** The link-preview picture for pages without a photo of their own (made by scripts/app/og-image.mjs). */
export const OG_IMAGE = { url: "/og.jpg", width: 1200, height: 630, alt: "Best Vape Shop Australia: big clouds, better prices" };
/** Open Graph tags every page shares. The layout sets these for pages that don't call pageMetadata. */
export const OPEN_GRAPH = { siteName: SITE_NAME, locale: "en_AU", type: "website", images: OG_IMAGE } as const;

/** JSON-LD for a <script> tag, with "<" escaped so text from the database can't close the tag. */
export const jsonLd = (data: object) => JSON.stringify(data).replace(/</g, "\\u003c");

/** The store as an organisation, for the home and About pages. The ABN and address show once set in the admin. */
export function onlineStoreJsonLd({ abn, address }: { abn: string | null; address: string | null }) {
  return {
    "@type": "OnlineStore",
    "@id": `${SITE_URL}/#store`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/icons/icon-512.png`,
    image: `${SITE_URL}${OG_IMAGE.url}`,
    email: CONTACT_EMAIL,
    telephone: CONTACT_PHONE,
    areaServed: { "@type": "Country", name: "Australia" },
    currenciesAccepted: "AUD",
    ...(abn ? { taxID: abn } : {}),
    ...(address ? { address } : {}),
  };
}

const MAX_TITLE = 60; // about as much as Google shows before cutting a title off
const MAX_DESCRIPTION = 160; // and of a description
const DELIVERY = "Tracked delivery Australia-wide.";
/** The first description that fits in a search result, or the last when none do. */
const fitDescription = (...ds: string[]) => ds.find((d) => d.length <= MAX_DESCRIPTION) ?? ds[ds.length - 1];

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
    openGraph: { ...OPEN_GRAPH, title: typeof title === "string" ? title : title.absolute, description, url: path, images: image ?? OG_IMAGE },
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

/**
 * THC and CBD products awaiting legal review: no search optimisation, and the blog never shows them.
 * Cannabinoid liquids were also imported as plain e-liquids: they name CBD/CBG in the title or come in
 * strengths no nicotine liquid has ("60ml (3000mg)"; nicotine tops out around 50mg).
 */
export const underReview = (p: Pick<ProductSeoInput, "type" | "name" | "nicotineMg"> & { brand: { slug: string } | null }) =>
  p.type === "cbd" ||
  UNDER_REVIEW_BRANDS.has(p.brand?.slug ?? "") ||
  /\b(cbd|cbg|cbn|thc|hhc|delta[- ]?[89])\b/i.test(p.name) ||
  (p.nicotineMg ?? 0) > 100;

// The importer guessed flavours from product names and about one in ten came out mangled ("Grape Peach By",
// "Peach-Jam-Geek- - -X-", "Flavour Custom Pack"), so a flavour is only used when it reads as plain words.
const cleanFlavour = (f: string | null) =>
  f && f.length <= 32 && /^[A-Za-z][A-Za-z' &-]*$/.test(f) && !/\s-|-\s|-$/.test(f) && !/\b(by|pack|bulk|box|custom|mixed|case|kit)\b/i.test(f) ? f : null;

/**
 * A product name as a search result should show it. The import left clutter in many names: "Vape Device",
 * "9000 Puff", "*5" for a five-pack, "- High-Puff Vape Bundle". Only the <title> uses this; the page keeps its name.
 */
export function tidyName(name: string): string {
  return name
    .replace(/\s*\*\s*(\d+)\s*$/, " $1 Pack")
    .replace(/\b(disposable\s+)?vape\s+device\b/gi, "")
    .replace(/\s*-\s*high-puff vape bundle\b/gi, "")
    .replace(/(\d)\s*puff\b/gi, "$1 Puffs")
    .replace(/\s{2,}/g, " ")
    .replace(/[\s-]+$/, "")
    .trim();
}

/**
 * The puff count in the name, the way Australians search for it ("iget bar pro 10000 puffs", "hqd cuvie slick
 * 6000"): added before the flavour when the name doesn't already say it.
 */
export function withPuffs(name: string, puffs: number | null): string {
  if (!puffs) return name;
  const plain = name.replace(/(\d),(\d{3})/g, "$1$2");
  const k = puffs % 1000 === 0 ? `|${puffs / 1000}k` : "";
  if (new RegExp(`\\b(${puffs}${k})\\b`, "i").test(plain)) {
    // The number is there; say what it counts when nothing else does ("HQD Cuvie Slick 6000" -> "... 6000 Puffs").
    return /\bpuffs?\b/i.test(name) ? name : name.replace(new RegExp(`\\b${puffs}\\b(?!\\s*(mg|ml)\\b)`), `${puffs} Puffs`);
  }
  const dash = name.indexOf(" - ");
  return dash > 0 ? `${name.slice(0, dash)} ${puffs} Puffs${name.slice(dash)}` : `${name} ${puffs} Puffs`;
}

/** "an IGET Bar...", "an 8,000-puff...", "a Geek Bar...". */
const article = (next: string) => (/^([aeiou]|8|1[18](,|\d{3}\b|\b))/i.test(next) ? "an" : "a");

/** "50mg nicotine", with trailing zeros dropped ("3.00" -> "3"). */
const nicotine = (mg: number | null) => (mg ? `${Number(mg.toFixed(2))}mg nicotine` : null);

/**
 * The full <title> for a product page (no store-name suffix: Google shows the site name on its own line).
 * Range, puffs and flavour first, then what the product is plus "Australia", shortened until it fits.
 */
export function productTitle(p: ProductSeoInput): string {
  if (p.metaTitle) return p.metaTitle;
  if (underReview(p)) return `${p.name}${TITLE_SUFFIX}`;
  if (/australia/i.test(p.name)) return p.name;
  const name = tidyName(p.name);
  const says = (word: RegExp) => word.test(name);

  if (p.type === "bundle" || (p.type === "disposable" && p.packSize > 1)) {
    const packed = p.packSize > 1 && !says(/\b(pack|pcs|pieces|box|bundle|x\s?\d+)\b/i) ? `${name} (${p.packSize} Pack)` : name;
    const label = says(/\bbulk\b/i) ? "Australia" : "Bulk Buy Australia";
    return fit(`${packed} | ${label}`, `${packed} | Bulk Buy AU`, packed);
  }
  if (p.type === "disposable") {
    const core = withPuffs(name, p.puffs);
    return fit(
      `${core} | Disposable Vape Australia`,
      `${core} | Vape Australia`,
      `${core} | Vape AU`,
      ...(core === name ? [] : [`${name} | Vape Australia`]),
      core,
    );
  }
  // What shoppers add to the name ("... e-liquid australia", "... nicotine pouches australia"); accessories,
  // coils and glass take their category's name ("Vape Accessories"). Skipped when the name already says it.
  const label = TITLE_LABEL[p.type] ?? (p.primary?.kind === "type" ? p.primary.name : null);
  const already =
    !label ||
    (p.type === "e_liquid" && says(/liquid|juice/i)) ||
    (p.type === "nicotine_pouch" && says(/pouch/i)) ||
    (p.type === "pod_kit" && says(/\bkit\b/i)) ||
    name.toLowerCase().includes(label.split(" ")[0].toLowerCase());
  return fit(...(already ? [] : [`${name} | ${label} Australia`]), `${name} | Australia`, name);
}

/**
 * The meta description: what it is (range, puffs, flavour, nicotine), the price, then buying and delivery, in the
 * words people search with ("buy", "disposable vape", "vape juice", "bulk buy", "wholesale").
 */
export function productDescription(p: ProductSeoInput): string | null {
  if (p.metaDescription) return p.metaDescription;
  if (underReview(p)) return p.shortDescription;
  const price = formatPrice(p.price);
  const name = tidyName(p.name);
  // The range is what people search for ("IGET Bar Plus"); the brand when there's no series.
  const range = p.primary?.kind === "series" ? p.primary.name : (p.brand?.name ?? null);
  const flavour = cleanFlavour(p.flavour) ? ` in ${p.flavour}` : "";
  const nic = nicotine(p.nicotineMg);

  if (p.packSize > 1 && (p.type === "disposable" || p.type === "bundle" || p.type === "nicotine_pouch")) {
    const unit = p.type === "nicotine_pouch" ? "tin" : "vape";
    const each = formatPrice(Math.round((p.price / p.packSize) * 100) / 100);
    const puffs = p.puffs ? ` (${thousands(p.puffs)} puffs each)` : "";
    const buy = /^bulk\b/i.test(name) ? name : `Bulk buy ${name}`;
    return fitDescription(
      `${buy} for ${price}, just ${each} a ${unit}${puffs}. Wholesale pricing with tracked delivery Australia-wide.`,
      `${buy} for ${price}, just ${each} a ${unit}. ${DELIVERY}`,
      `${name}: ${price}, ${each} a ${unit}. ${DELIVERY}`,
    );
  }
  if (p.type === "bundle") {
    const buy = /^bulk\b/i.test(name) ? name : `Bulk buy ${name}`;
    return fitDescription(`${buy} for ${price}. Wholesale pricing with tracked delivery Australia-wide.`, `${name}, ${price}. ${DELIVERY}`);
  }
  if (p.type === "disposable") {
    // "HQD Cuvie Slick 6000" already says its puffs; "HQD Cuvie Slick 6000 6,000-puff" would say them twice.
    const rangeSaysPuffs = Boolean(p.puffs && range && withPuffs(range, p.puffs) !== `${range} ${p.puffs} Puffs`);
    const what = `${range ? `${range} ` : ""}${p.puffs && !rangeSaysPuffs ? `${thousands(p.puffs)}-puff ` : ""}disposable vape`;
    // Without a clean flavour the name carries it ("Grape Fruit Refresher Geek Bar Pulse X 25000"), so no two read alike.
    const buy = flavour ? `Buy the ${what}${flavour}` : `Buy ${name}, ${article(what)} ${what}`;
    return fitDescription(
      `${buy}${nic ? ` (${nic})` : ""} for ${price}. Genuine stock with tracked delivery Australia-wide.`,
      `${buy} for ${price}. Genuine stock with tracked delivery Australia-wide.`,
      `${buy} for ${price}. ${DELIVERY}`,
      `${name}, ${price}. ${DELIVERY}`,
    );
  }
  if (p.type === "e_liquid") {
    // Led by the name: the import's flavour field is often "Short Fill" or "Ice", and the name says the real one.
    const strength = [p.volumeMl && `${p.volumeMl}ml`, p.nicotineMg && `${Number(p.nicotineMg.toFixed(2))}mg`].filter(Boolean).join(" ");
    const lead = `${name}: ${strength ? `${strength} ` : ""}${range && !name.toLowerCase().includes(range.toLowerCase()) ? `${range} ` : ""}e-liquid, ${price}.`;
    return fitDescription(`${lead} Buy vape juice online with tracked delivery Australia-wide.`, `${lead} ${DELIVERY}`, `${name}, ${price}. ${DELIVERY}`);
  }
  if (p.type === "pod_kit") {
    const lead = `${name}: a ${range ? `${range} ` : ""}pod kit${p.puffs ? ` (${thousands(p.puffs)} puffs)` : ""}, ${price}.`;
    return fitDescription(`${lead} Buy online with tracked delivery Australia-wide.`, `${lead} ${DELIVERY}`);
  }
  if (p.type === "nicotine_pouch") {
    const lead = `${range ? `${range} ` : ""}nicotine pouches${flavour}${p.nicotineMg ? `, ${Number(p.nicotineMg.toFixed(2))}mg` : ""}, ${price}.`;
    return fitDescription(`${capitalise(lead)} Buy online with tracked delivery Australia-wide.`, `${capitalise(lead)} ${DELIVERY}`);
  }
  // Accessories, glassware and the rest: the name says what it is; its category says where it sits.
  const shelf = (p.primary?.name ?? "vape gear").toLowerCase();
  return fitDescription(`Buy ${name} for ${price}, from our ${shelf} range. ${DELIVERY}`, `${name}, ${price}. ${DELIVERY}`);
}

// ---------------------------------------------------------------------------
// Categories and brands
// ---------------------------------------------------------------------------

type ListingSeoInput = { name: string; count: number; fromPrice: number | null };

const products = (count: number) => `${thousands(count)} ${count === 1 ? "product" : "products"}`;
const from = (l: ListingSeoInput) => (l.fromPrice ? ` from ${formatPrice(l.fromPrice)}` : "");

// The store's main shelves, written for their head searches (Google Australia autocomplete, 20 Nov 2026):
// "disposable vapes australia", "buy vapes online australia", "e liquid australia", "vape juice australia",
// "vape bulk buy australia", "iget vapes bulk cheap australia". The rest are built from the category's details.
const SHELVES: Record<string, { title: string; lead: string }> = {
  "disposable-vapes": { title: "Disposable Vapes Australia: Buy Vapes Online", lead: "Buy disposable vapes online in Australia" },
  "e-liquids": { title: "E-Liquids & Vape Juice Australia: Buy Online", lead: "Buy e-liquid and vape juice online, freebase and nicotine salt" },
  "eliquide-juice": { title: "E-Juice Australia: Vape Juice & Large Bottles", lead: "More vape juice brands, including large bottles" },
  "vape-accessories": { title: "Vape Accessories Australia: Coils, Pods & Chargers", lead: "Vape coils, pods, chargers and kits" },
  tanks: { title: "Vape Tanks Australia: Sub-Ohm Tanks", lead: "Sub-ohm vape tanks" },
  "bulk-buy": { title: "Vape Bulk Buy Australia: Wholesale Vape Packs", lead: "Bulk buy vapes at wholesale prices: mixed-brand packs of 10, 20 and 100" },
  "iget-vapes-bulk-buy": { title: "IGET Bulk Buy Australia: Wholesale IGET Vapes", lead: "Bulk buy IGET vapes at wholesale prices, priced by the box" },
};

/** "IGET Bar Pro, 10,000 puffs." -> 10000 */
const taglinePuffs = (tagline: string | null) => {
  const m = tagline?.match(/(\d{1,3}(?:,\d{3})+|\d{4,6})\s*puffs/i);
  return m ? Number(m[1].replace(/,/g, "")) : null;
};

/**
 * Category pages. A range reads "IGET Bar Pro 10000 Puffs: All Flavours | Australia" (range, puffs and
 * "flavours" are how Australians search for one); a brand "Alibarbar Vapes Australia: All Flavours & Models";
 * the main shelves have their own titles above. These are whole titles, without the store-name suffix.
 */
export function categorySeo(
  c: ListingSeoInput & { slug?: string; kind?: CategoryKind; tagline: string | null; brandSlug: string | null; metaTitle: string | null; metaDescription: string | null },
): { title: string | { absolute: string }; description: string | undefined } {
  if (UNDER_REVIEW_BRANDS.has(c.brandSlug ?? "")) return { title: c.metaTitle ?? c.name, description: c.metaDescription ?? c.tagline ?? undefined };
  const tagline = c.tagline ? `${c.tagline} ` : "";
  const delivery = "with tracked delivery to every state and territory.";
  const generic = `${tagline}Shop ${products(c.count)}${from(c)}, ${delivery}`;
  const shelf = c.slug ? SHELVES[c.slug] : undefined;
  // Coils, tanks and kits don't come in flavours.
  const flavoured = !/coil|tank|kit|halo|glass|bong|accessor/i.test(`${c.name} ${c.tagline ?? ""}`);

  let title: string | { absolute: string };
  let description: string;
  if (shelf) {
    title = { absolute: shelf.title };
    description = fitDescription(
      `${shelf.lead}: ${products(c.count)}${from(c)}. Genuine stock, ${delivery}`,
      `${shelf.lead}: ${products(c.count)}${from(c)}, ${delivery}`,
      generic,
    );
  } else if (c.kind === "series" && flavoured) {
    const core = withPuffs(c.name, taglinePuffs(c.tagline));
    title = { absolute: fit(`${core}: All Flavours | Australia`, `${core} Flavours | Australia`, `${core} | Australia`, core) };
    description = fitDescription(
      `${tagline}Shop every ${c.name} flavour, ${products(c.count)}${from(c)}. Genuine stock, ${delivery}`,
      `${tagline}Shop every ${c.name} flavour, ${products(c.count)}${from(c)}, ${delivery}`,
      generic,
    );
  } else if (c.kind === "brand") {
    const liquid = /juice|liquid/i.test(`${c.name} ${c.tagline ?? ""}`);
    title = {
      absolute: liquid
        ? fit(`${c.name} E-Liquid Australia: All Flavours`, `${c.name} E-Liquid Australia`)
        : fit(`${c.name} Vapes Australia: All Flavours & Models`, `${c.name} Vapes Australia: All Flavours`, `${c.name} Vapes Australia`),
    };
    description = fitDescription(
      `${tagline}Shop every ${c.name} flavour and model, ${products(c.count)}${from(c)}. Genuine stock, ${delivery}`,
      `${tagline}Shop ${products(c.count)}${from(c)}. Genuine stock, ${delivery}`,
      generic,
    );
  } else {
    title = inAustralia(c.name);
    description = generic;
  }
  return { title: c.metaTitle ?? title, description: c.metaDescription ?? description };
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
