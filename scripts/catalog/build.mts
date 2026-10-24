// Turns the live-store snapshot (.catalog-cache) plus our taxonomy and research into
// the committed seed data in prisma/data/catalog/. The seed only reads those files.
// usage: npx tsx scripts/catalog/build.mts taxonomy|products
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { brands, categories as taxonomy } from "../../prisma/data/taxonomy";

const ROOT = process.cwd();
const CACHE = path.join(ROOT, ".catalog-cache");
const OUT = path.join(ROOT, "prisma", "data", "catalog");

type WooCategory = { id: number; slug: string; name: string; description: string; image: { src: string } | null };
type ImageEntry = { key: string; style?: string; uploaded?: boolean; width: number; height: number; score?: number; error?: string };

const readJson = async <T,>(file: string): Promise<T> => JSON.parse(await readFile(file, "utf8")) as T;

export async function buildTaxonomy() {
  const live = await readJson<WooCategory[]>(path.join(CACHE, "woo", "categories.json"));
  const images = await readJson<Record<string, ImageEntry>>(path.join(CACHE, "images", "categories.json"));
  const bySlug = new Map(live.map((c) => [c.slug, c]));

  const missing = live.filter((c) => !taxonomy.some((t) => t.slug === c.slug)).map((c) => c.slug);
  if (missing.length) throw new Error(`live categories missing from taxonomy.ts: ${missing.join(", ")}`);

  const categories = taxonomy.map((t, index) => {
    const source = bySlug.get(t.slug);
    const image = images[t.slug];
    const notes = [t.review].filter(Boolean) as string[];
    if (image && !image.uploaded) throw new Error(`image for ${t.slug} not uploaded yet`);
    if (image?.style === "photo" && (image.score ?? 1) < 0.3) {
      notes.push("Image is a styled promo photo from the store; swap for a clean shot if one exists.");
    }
    if (!image && !t.hidden) notes.push("No image available.");
    return {
      wooId: source?.id ?? null,
      slug: t.slug,
      name: t.name,
      kind: t.kind,
      brand: t.brand ?? null,
      parent: t.parent ?? null,
      tagline: t.tagline || null,
      description: source?.description?.trim() || null,
      imageKey: image?.key ?? null,
      imageSourceUrl: source?.image?.src ?? null,
      isVisible: !t.hidden,
      isFeatured: t.featured !== undefined,
      sortOrder: t.featured ?? 100 + index,
      needsReview: notes.length > 0,
      reviewNotes: notes,
    };
  });

  await mkdir(OUT, { recursive: true });
  await writeFile(
    path.join(OUT, "taxonomy.json"),
    JSON.stringify({ brands: brands.map(({ slug, name }, i) => ({ slug, name, sortOrder: i })), categories }, null, 1)
  );
  console.log(`taxonomy: ${brands.length} brands, ${categories.length} categories, ${categories.filter((c) => c.needsReview).length} flagged for review`);
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

type WooProduct = {
  id: number;
  slug: string;
  name: string;
  description: string;
  short_description: string;
  prices: { price: string; regular_price: string };
  images: { src: string; alt: string }[];
  categories: { slug: string }[];
};

/** Hand-researched values (prices, names, pack size) keyed by live product ID. See research.json. */
type Research = Record<
  string,
  { priceCents?: number; regularPriceCents?: number; name?: string; packSize?: number; source: string; note?: string }
>;
/** Photo for a product the store has none for: another listing's photo, or a composed range shot. */
type ImageOverride = { from?: number; compose?: number[]; note: string };

/** Notes that record what was done; anything else still needs a person to act on it. */
const INFO_NOTE = /^(Price (researched|matched|confirmed)|Name recovered|Name:|Store title was keyword-stuffed|Photo taken from the store's|Category inferred)/;

const SMALL_WORDS = new Set(["and", "with", "of", "in", "the", "n"]);
const tidyFlavour = (s: string) =>
  s
    .split(" ")
    .map((w, i) => (w === w.toLowerCase() && !(i > 0 && SMALL_WORDS.has(w)) ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");

const ENTITIES: Record<string, string> = { amp: "&", quot: '"', apos: "'", nbsp: " ", lt: "<", gt: ">", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", Prime: "″", prime: "′" };
const decode = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n] ?? m);
const stripTags = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

const ACRONYMS = new Set(["IGET", "HQD", "ACE", "SMOK", "CBD", "XXL", "XL", "AIO", "RDA", "RTA", "MTL", "DTL", "USB", "LED", "OG", "MVS", "TFV16", "GX", "G3", "G4", "B60", "WTF", "TNT"]);
const SEPARATORS = /\s+[–—|-]\s+|\s*\|\s*/;

function titleCase(word: string) {
  const upper = word.toUpperCase();
  if (ACRONYMS.has(upper.replace(/[^A-Z0-9]/g, ""))) return upper;
  if (/^\d*(ML|MG|PCS|MM)$/i.test(word)) return word.toLowerCase();
  if (/\d/.test(word)) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** Recurring typos in store titles ("lce" for Ice, a capital I for l in "BIackberry", ...). */
const TYPOS: [RegExp, string][] = [
  [/\blce\b/g, "Ice"],
  [/\bCuive\b/gi, "Cuvie"],
  [/\bBI(?=[a-z])/g, "Bl"],
  [/\bChuppa Chupps\b/gi, "Chupa Chups"],
  [/\bpremuim\b/gi, "premium"],
];
export const fixTypos = (s: string) => TYPOS.reduce((out, [rx, to]) => out.replace(rx, to), s);

/** Tidies a store title: entities, typos, prices, SEO filler, shouting caps, keyword-stuffed tails. */
function cleanName(raw: string): { name: string; truncated: boolean } {
  let name = fixTypos(decode(raw).replace(/\s+/g, " ").trim());
  name = name.replace(/\s*\$\d[\d,]*(\.\d{2})?\b/g, "").replace(/\s+(premium\s+)?best$/i, "");
  let segments = name.split(SEPARATORS).map((s) => s.trim()).filter(Boolean);
  segments = segments
    .map((s) => s.replace(/\s*(premium\s+)?(vapes?\s+)?australia$/i, "").trim())
    .filter((s) => s && !/^(premium|best|buy|online)$/i.test(s));
  name = segments.join(" - ");
  const letters = name.replace(/[^A-Za-z]/g, "");
  if (letters.length > 6 && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.7) {
    name = name.split(" ").map(titleCase).join(" ");
  }
  name = name.replace(/(\d)\s*pcs\b/gi, "$1 pcs").replace(/\b(\w+)\s+\1\b/gi, "$1"); // "Alibarbar Alibarbar Ingot"
  let truncated = false;
  if (name.length > 110) {
    name = (segments[0] ?? name).slice(0, 90).replace(/\s+\S*$/, "");
    truncated = true;
  }
  return { name, truncated };
}

const PUFFS = /(\d{1,2}[,.]?\d{3})\s*puffs?/i;
const parseInt10 = (s: string) => Number(s.replace(/[,.]/g, ""));

/** Model numbers that are puff counts, e.g. "Geek Bar Pulse X 25000" (no "puffs" word). Names only. */
function modelPuffs(name: string) {
  const m = name.match(/\b(\d{1,2}[,.]?\d{3})\b(?!\s*(mg|ml|mah|mm|w\b))/i);
  const n = m ? parseInt10(m[1]) : 0;
  return n >= 1000 && n <= 60000 ? n : null;
}

function specs(text: string) {
  const puffs = text.match(PUFFS);
  const ml = text.match(/(\d{1,4})\s*ml\b/i);
  const mg = text.match(/(\d{1,4}(?:\.\d+)?)\s*mg\b/i);
  const pack = text.match(/(\d{1,3})\s*(?:pack|pcs|pieces|pods)\b|\bpack of (\d{1,3})|\b(\d{1,3})\s*x\b/i);
  return {
    puffs: puffs ? parseInt10(puffs[1]) : null,
    volumeMl: ml ? Number(ml[1]) : null,
    nicotineMg: mg ? Number(mg[1]) : null,
    packSize: pack ? Number(pack[1] ?? pack[2] ?? pack[3]) : null,
  };
}

const FAMILY_RULES: [RegExp, string][] = [
  [/tobacco|cigar|ry4/i, "tobacco"],
  [/\b(spear|pepper)?mint\b|menthol/i, "mint"],
  [/cream|custard|vanilla|cake|cookie|caramel|chocolate|donut|doughnut|black forest|cereal|milk|yog(h)?urt|pudding|crispy|marshmallow|pastry|pavlova|tart|pie|honey|toffee|candy|gummy|bubble ?gum|hubba|chupa|chuppa|lolly/i, "dessert"],
  [/cola|energy|red ?bull|lemonade|soda|coffee|latte|tea\b|mojito|drink|slush/i, "drink"],
  [/\bice\b|\biced\b|cool|frost|chill|freeze/i, "iced"],
  [/berry|apple|grape|mango|melon|peach|lemon|lime|orange|banana|pineapple|kiwi|lychee|guava|passion|cherry|pomegranate|strawberry|watermelon|fruit|citrus|apricot|plum|pear|coconut|currant|cranberry|tropical|dragon/i, "fruit"],
];
const flavourFamily = (text: string) => FAMILY_RULES.find(([rx]) => rx.test(text))?.[1] ?? null;

const NON_FLAVOUR = /\b(\d[\d,.]*\s*(puffs?|ml|mg|pcs|pack)|disposable|vapes?|pod(s)?|kit|device|e-?liquid|e-?juice|salt|freebase|nic(otine)?|shortfill|premium|australia|bundle|only|introduction|oral|pouch(es)?|x1|series)\b/gi;

/** Picks the flavour out of names like "Banana Ice – IGET Bar 3500 Puffs" or "HQD Cuvie Slick 20000 – Apple Grape". */
function extractFlavour(name: string, strip: string[]): string | null {
  const segments = name.split(SEPARATORS);
  const scrub = (s: string) => {
    let out = ` ${s} `;
    for (const token of strip) out = out.replace(new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), " ");
    return out.replace(NON_FLAVOUR, " ").replace(/\b\d+\b/g, " ").replace(/[()[\],.–—|]+/g, " ").replace(/\s+/g, " ").trim();
  };
  const candidates = segments.map(scrub).filter((s) => s.length > 1 && s.split(" ").length <= 5);
  const pick = candidates.find((s) => flavourFamily(s)) ?? candidates[0];
  return pick ? pick.split(" ").map((w) => (w === w.toUpperCase() && w.length > 3 ? titleCase(w) : w)).join(" ") : null;
}

const TYPE_BY_CATEGORY: Record<string, string> = {
  "e-liquids": "e_liquid", "eliquide-juice": "e_liquid", "bar-juice-5000-nicotine-salt-e-liquid": "e_liquid", "nasty-juice": "e_liquid", "vapengin-e-liquid": "e_liquid",
  "vape-accessories": "accessory", tanks: "accessory", "freemax-coils": "accessory",
  "glass-bongs": "glassware", "iget-shion-x1-nicotine-pouch": "nicotine_pouch", "supreme-cbd": "cbd", "iget-halo-vape-kit": "pod_kit",
};

function productType(cats: string[], name: string, packSize: number) {
  for (const c of cats) if (TYPE_BY_CATEGORY[c]) return TYPE_BY_CATEGORY[c];
  if (packSize > 1 || cats.some((c) => c.includes("bulk-buy"))) return "bundle";
  if (/cleaner|bristle|brush|gift set/i.test(name)) return "accessory";
  if (/\b(aio|dry herb|refillable|wenax)\b/i.test(name)) return "pod_kit";
  if (!PUFFS.test(name) && /pod (vape )?device|pod system|pod kit|\bkit\b|\bmod\b|vaporizer|concentrate|\bdab\b/i.test(name)) return "pod_kit";
  if (cats.length) return "disposable";
  if (/e-?liquid|shortfill|\d+\s*ml\b/i.test(name)) return "e_liquid";
  if (/pouch/i.test(name)) return "nicotine_pouch";
  if (/bong|bubbler|pipe|stash|beeswax|rubies|jar|stem|coil|tank|charger|o-ring/i.test(name)) return "accessory";
  if (PUFFS.test(name)) return "disposable";
  return "other";
}

/** Category guesses for products the live store left uncategorised (checked in order). */
const INFER_CATEGORY: [RegExp, string][] = [
  [/iget one/i, "iget-one-12000"], [/iget legend/i, "iget-legend"], [/iget xxl/i, "iget-xxl"], [/iget moon/i, "iget-moon"],
  [/alibarbar.*\b\d+\s*pcs\b/i, "bulk-buy"], [/alibarbar/i, "alibarbar"],
  [/e-?liquid|shortfill|\d+\s*ml\b/i, "e-liquids"],
  [/bong|bubbler/i, "glass-bongs"],
  [/coil|pipe|stash|beeswax|rubies|brick/i, "vape-accessories"],
];

const RETAILER_IN_FILENAME = /(vapelink|ozvape|vapeking|vapourium|vapeshop|\.com_?\.au)/i;

export async function buildProducts() {
  const products = await readJson<WooProduct[]>(path.join(CACHE, "woo", "products.json"));
  const images = await readJson<Record<string, ImageEntry>>(path.join(CACHE, "images", "products.json"));
  const researchFile = await readJson<Record<string, unknown>>(path.join(ROOT, "prisma", "data", "research.json")).catch(() => ({}) as Record<string, unknown>);
  const meta = (researchFile._meta ?? {}) as { pricesConfirmedOn?: string };
  const research = Object.fromEntries(Object.entries(researchFile).filter(([k]) => k !== "_meta")) as Research;
  const overrides = await readJson<Record<string, ImageOverride>>(path.join(ROOT, "prisma", "data", "image-overrides.json")).catch(
    () => ({}) as Record<string, ImageOverride>
  );
  const byId = new Map(products.map((p) => [p.id, p]));
  const taxonomyBySlug = new Map(taxonomy.map((t) => [t.slug, t]));
  const KIND_RANK = { series: 0, brand: 1, type: 2, collection: 3 } as const;
  const brandName = new Map(brands.map((b) => [b.slug, b.name]));

  const positions = new Map<string, number>();
  const firstByName = new Map<string, string>(); // name -> slug of the first listing with it

  const draft = products.map((p) => {
    const notes: string[] = [];
    const firstHeading = stripTags(p.description.match(/<(h[1-4]|strong)[^>]*>([\s\S]*?)<\/\1>/)?.[2] ?? "");
    const imageFile = p.images[0]?.src.split("/").pop() ?? "";

    // Name: tidy the store title; recover it when the store left it blank or as "Product".
    const cleaned = cleanName(p.name);
    let name = cleaned.name;
    if (cleaned.truncated) notes.push("Store title was keyword-stuffed; shortened.");
    if (research[p.id]?.name) {
      name = research[p.id].name!;
      notes.push(`Name: ${research[p.id].source}`);
    } else if (!name || /^product$/i.test(name)) {
      const pouch = imageFile.match(/^(.*?)-iget-shion-nicotine-pouch-(\d+mg)/i);
      name = pouch
        ? `IGET Shion X1 ${pouch[1].split("-").map(titleCase).join(" ")} ${pouch[2].toLowerCase()}`
        : cleanName(firstHeading).name;
      notes.push(pouch ? "Name recovered from the photo's file name." : "Name recovered from the description heading.");
    }

    // Categories: live ones, or a best guess for uncategorised products.
    let cats = p.categories.map((c) => c.slug).filter((s) => s !== "uncategorized");
    if (!cats.length) {
      const haystack = `${name} ${stripTags(p.description).slice(0, 400)}`;
      const guess = INFER_CATEGORY.find(([rx]) => rx.test(haystack))?.[1];
      if (guess) {
        cats = [guess];
        notes.push(`Category inferred (${guess}); the store had none.`);
      } else {
        notes.push("No category on the store and none could be inferred.");
      }
    }
    const primary = [...cats].sort(
      (a, b) => KIND_RANK[taxonomyBySlug.get(a)?.kind ?? "collection"] - KIND_RANK[taxonomyBySlug.get(b)?.kind ?? "collection"]
    )[0];
    const series = primary ? taxonomyBySlug.get(primary) : undefined;

    // Brand: from the category, else from a known brand name in the title.
    const lower = ` ${name.toLowerCase()} `;
    const brand =
      cats.map((c) => taxonomyBySlug.get(c)?.brand).find(Boolean) ??
      brands.find((b) => b.aliases.some((a) => lower.includes(` ${a} `) || lower.includes(` ${a}`)))?.slug ??
      null;

    // Legal and other category-level review notes apply to every product in the range.
    const reviewFromCategory = cats.map((c) => taxonomyBySlug.get(c)?.review).find(Boolean);

    // Specs: title first (including model numbers like "Pulse X 25000"), then the store's own
    // description, then the series default. THC ranges are sold by weight, so puffs don't apply.
    const fromName = specs(name);
    const fromDescription = specs(stripTags(p.description));
    const packSize = research[p.id]?.packSize ?? fromName.packSize ?? 1;
    const type = productType(cats, name, packSize);
    let puffs = fromName.puffs ?? (["disposable", "bundle"].includes(type) ? modelPuffs(name) : null);
    if (!puffs && ["disposable", "bundle"].includes(type)) puffs = series?.puffs ?? fromDescription.puffs;
    if (!puffs && type === "disposable" && !reviewFromCategory) notes.push("Puff count unknown.");

    const stripTokens = [
      ...(brand ? brands.find((b) => b.slug === brand)!.aliases : []),
      ...(series ? [series.name, series.name.replace(/\s*\d[\d,]*$/, "")] : []),
      "iget", "hqd", "cuive", "cuvie", "slick", "bar", "plus", "moon", "legend", "goat", "flare", "one", "xxl", "halo", "shion", "pulse x", "pulse",
    ];
    const rawFlavour = ["disposable", "e_liquid", "nicotine_pouch", "cbd", "bundle"].includes(type) ? extractFlavour(name, stripTokens) : null;
    const flavour = rawFlavour ? tidyFlavour(rawFlavour) : null;

    // Consistent names for single bars and pouches in a series: "IGET Bar 3500 Puffs - Banana Ice",
    // "HQD Cuvie Slick 20000 - Mixed Berry", "IGET Shion X1 Pouches - Apple 6mg". The store title is kept in sourceName.
    if (series?.kind === "series" && !series.review && packSize === 1 && flavour && ["disposable", "nicotine_pouch"].includes(type)) {
      const puffLabel = type === "disposable" && puffs && !/\d/.test(series.name) ? ` ${puffs} Puffs` : "";
      const strength = type === "nicotine_pouch" && fromName.nicotineMg ? ` ${fromName.nicotineMg}mg` : "";
      name = `${series.name}${puffLabel} - ${flavour}${strength}`;
    }

    // Prices (cents). $0 on the store means unpriced: filled from research or siblings later.
    let priceCents = Number(p.prices.price);
    let regularPriceCents = Number(p.prices.regular_price) || priceCents;
    if (research[p.id]?.priceCents) {
      priceCents = research[p.id].priceCents!;
      regularPriceCents = research[p.id].regularPriceCents ?? priceCents;
      notes.push(`Price researched: ${research[p.id].source}${research[p.id].note ? ` (${research[p.id].note})` : ""}`);
    }

    // Images: processed cutouts in the bucket. Products with no photo borrow one from the
    // store's identical (or closest) listing, or a composed range shot (image-overrides.json).
    const toImage = (src: string, alt: string, position: number) => {
      const entry = images[src];
      if (!entry || entry.error || !entry.uploaded) return null;
      // Every cutout keeps ~20% transparent padding, so a score just above that means nothing was removed:
      // the photo kept its own backdrop and should fill the tile instead of sitting padded on it.
      const hasBackground = !src.startsWith("override:") && (entry.score ?? 1) < 0.23;
      return { key: entry.key, sourceUrl: src.startsWith("override:") ? null : src, alt: decode(alt).trim() || name, width: entry.width, height: entry.height, hasBackground, position };
    };
    let sourceImages = p.images;
    const override = !p.images.length ? overrides[p.id] : undefined;
    if (override?.from) sourceImages = byId.get(override.from)?.images.slice(0, 1) ?? [];
    let productImages = sourceImages
      .map((img, position) => toImage(img.src, img.alt, position))
      .filter((i): i is NonNullable<typeof i> => i !== null);
    if (override?.compose) productImages = [toImage(`override:${p.id}`, name, 0)].filter((i): i is NonNullable<typeof i> => i !== null);
    if (override && productImages.length) notes.push(override.note);
    else if (!p.images.length) notes.push("No product photo on the store.");
    else if (productImages.length < p.images.length) notes.push("Some photos could not be processed.");
    if (sourceImages.some((img) => RETAILER_IN_FILENAME.test(img.src.split("/").pop() ?? ""))) {
      notes.push("Photo file name points to another retailer; check image rights.");
    }

    // Featured = a single item (not a pack, whose photos are usually price banners) with a clean studio
    // cutout (mostly transparent after background removal) and no legal flag. Listings sort these first.
    const photoScore = override?.compose ? 0.6 : (images[sourceImages[0]?.src ?? ""]?.score ?? 0);
    const isFeatured =
      productImages.length > 0 && photoScore >= 0.45 && !reviewFromCategory && packSize === 1 && type !== "bundle";

    for (const c of cats) positions.set(c, (positions.get(c) ?? 0) + 1);
    if (!firstByName.has(name.toLowerCase())) firstByName.set(name.toLowerCase(), p.slug);

    if (reviewFromCategory) notes.push(reviewFromCategory);

    return {
      wooId: p.id,
      slug: p.slug,
      name,
      sourceName: decode(p.name).trim() || null,
      type,
      description: p.description.trim() || null,
      priceCents,
      regularPriceCents: Math.max(regularPriceCents, priceCents),
      brand,
      flavour,
      flavourFamily: flavour ? flavourFamily(flavour) : null,
      puffs,
      volumeMl: fromName.volumeMl,
      nicotineMg: fromName.nicotineMg,
      packSize,
      categories: cats.map((slug) => ({ slug, isPrimary: slug === primary, position: positions.get(slug)! - 1 })),
      images: productImages,
      isFeatured,
      notes,
      researched: Boolean(research[p.id]?.priceCents),
    };
  });

  // Unpriced products ($0 on the store), in order of confidence:
  //  1. same brand line and size (name prefix + ml + pack), e.g. other "Iceberg Blow ... 60ml";
  //  2. same series with matching puffs/ml/pack. Accessories and glassware are too varied to
  //     match this way and go to research.json instead.
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const prefix = (name: string) => name.split(" - ")[0].toLowerCase();
  const priced = (o: (typeof draft)[number], d: (typeof draft)[number]) =>
    o !== d && o.priceCents > 0 && o.packSize === d.packSize && o.type === d.type && o.volumeMl === d.volumeMl;
  for (const d of draft.filter((x) => x.priceCents === 0)) {
    const primary = d.categories.find((c) => c.isPrimary)?.slug;
    const byLine = d.name.includes(" - ") ? draft.filter((o) => priced(o, d) && prefix(o.name) === prefix(d.name)) : [];
    const bySeries = ["accessory", "glassware", "other"].includes(d.type)
      ? []
      : draft.filter((o) => priced(o, d) && o.puffs === d.puffs && o.categories.some((c) => c.slug === primary));
    const [siblings, label] = byLine.length ? [byLine, `"${d.name.split(" - ")[0]}" listings of the same size`] : [bySeries, `${primary} products`];
    if (siblings.length >= (byLine.length ? 1 : 2)) {
      d.priceCents = median(siblings.map((s) => s.priceCents));
      d.regularPriceCents = Math.max(median(siblings.map((s) => s.regularPriceCents)), d.priceCents);
      d.researched = true;
      d.notes.push(`Price matched to ${siblings.length} other ${label} (median); the store listed it at $0.`);
    } else {
      d.notes.push("Price missing on the store ($0); research needed.");
    }
  }

  const out = draft.map(({ notes, researched, ...d }) => {
    const first = firstByName.get(d.name.toLowerCase());
    if (first && first !== d.slug) notes.push(`Duplicate listing of /product/${first}/; consider merging.`);
    if (researched && meta.pricesConfirmedOn) notes.push(`Price confirmed on ${meta.pricesConfirmedOn}.`);
    const typeLabel: Record<string, string> = {
      disposable: "Disposable vape", e_liquid: "E-liquid", pod_kit: "Pod kit", accessory: "Accessory", nicotine_pouch: "Nicotine pouches",
      cbd: "CBD product", glassware: "Glassware", bundle: "Bundle", other: "Product",
    };
    const facts = [
      d.puffs && `${d.puffs.toLocaleString("en-AU")} puffs`,
      d.volumeMl && `${d.volumeMl}ml`,
      d.nicotineMg && `${d.nicotineMg}mg`,
      d.packSize > 1 && `pack of ${d.packSize}`,
      d.flavour,
    ].filter(Boolean);
    const by = d.brand ? ` by ${brandName.get(d.brand)}` : "";
    return {
      ...d,
      shortDescription: `${typeLabel[d.type]}${by}.${facts.length ? ` ${facts.join(", ")}.` : ""}`,
      // Researched prices stay in draft until confirmed (research.json "_meta.pricesConfirmedOn").
      status: d.priceCents === 0 || (researched && !meta.pricesConfirmedOn) ? "draft" : "active",
      isPurchasable: d.priceCents > 0,
      needsReview: notes.some((n) => !INFO_NOTE.test(n)),
      reviewNotes: notes,
    };
  });

  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, "products.json"), JSON.stringify(out));
  const count = (f: (p: (typeof out)[number]) => boolean) => out.filter(f).length;
  console.log(
    `products: ${out.length} | active ${count((p) => p.status === "active")}, draft ${count((p) => p.status === "draft")} | ` +
      `flagged ${count((p) => p.needsReview)} | no images ${count((p) => !p.images.length)} | still $0 ${count((p) => p.priceCents === 0)}`
  );
}

const stage = process.argv[2];
if (stage === "taxonomy") await buildTaxonomy();
else if (stage === "products") await buildProducts();
else throw new Error("usage: build.mts taxonomy|products");
