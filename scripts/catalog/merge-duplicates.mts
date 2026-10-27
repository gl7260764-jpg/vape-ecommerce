// One-off clean-up (27 Oct 2026): the WooCommerce import brought in the same product up to five times
// ("…-vape", "…-vape-2" … "-5", unnamed "product-13" copies), which gave 334 products a title another
// product also had. For each set of copies this keeps one, archives the rest (reversible in the admin; order
// history stays) and records old address -> kept address in prisma/data/catalog/merged-products.json, which
// next.config.ts turns into 301 redirects. The kept copy takes over every category the copies were in.
// Where copies disagreed on price, PRICES below says which one to keep (the price closest to what Australian
// stores charged when checked; the most common or lower one where no store listed it).
// THC and CBD products awaiting legal review are left alone.
//
// usage: node --env-file=.env.local --conditions=react-server --import tsx scripts/catalog/merge-duplicates.mts [--apply]
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { productTitle, TITLE_SUFFIX } from "@/lib/seo";

const apply = process.argv.includes("--apply");
const RECORD = path.join(process.cwd(), "prisma", "data", "catalog", "merged-products.json");

// Different products the import gave one name, because it lost the flavour: their original store titles.
const RENAME: Record<string, { name: string; flavour: string }> = {
  "airmez-xbeats-40000-puffs-blue-rancher": { name: "Airmez Xbeats 40000 Puffs - Blue Rancher", flavour: "Blue Rancher" },
  "airmez-xbeats-40000-puffs-blue-razz": { name: "Airmez Xbeats 40000 Puffs - Blue Razz", flavour: "Blue Razz" },
  "airmez-xbeats-40000-puffs-mr-blue": { name: "Airmez Xbeats 40000 Puffs - Mr. Blue", flavour: "Mr. Blue" },
  "airmez-xbeats-40000-puffs-sour-fcuking-fab": { name: "Airmez Xbeats 40000 Puffs - Sour Fcuking Fab", flavour: "Sour Fcuking Fab" },
  "airmez-xbeats-40000-puffs-summer-dream": { name: "Airmez Xbeats 40000 Puffs - Summer Dream", flavour: "Summer Dream" },
  "hqd-click-plus-30000-fresh-berries": { name: "HQD Click Plus 30000 Puffs - Fresh Berries", flavour: "Fresh Berries" },
  "hqd-click-plus-30000-mixed-berries": { name: "HQD Click Plus 30000 Puffs - Mixed Berries", flavour: "Mixed Berries" },
};

// Copies listed at different prices: the price to keep, in cents, by product name. Market prices checked
// 27 Oct 2026 (AUD): single IGET Bar about $25-30, Bar Plus $30-35, Legend $25-33, Moon about $38 a bar in a
// 10-pack, XXL $15-20; boxes from ausbulkvapes.com.au: Bar Plus Pod 10 for $290 and 20 for $560, Bar Plus
// Kit 10 for $340. "no listing" = no Australian price found, so the lower (or most common) price is kept.
const PRICES: Record<string, number> = {
  "IGET Bar 3500 Puffs": 3900,
  "IGET Bar 3500 Puffs - Banana Pomegranate Cherry Ice": 4300,
  "IGET Bar 3500 Puffs - Grape Ice": 4400,
  "IGET Bar 3500 Puffs - Orange Mango Pineapple Ice": 4400,
  "IGET Bar 3500 Puffs - Raspberry Grape": 4400,
  "IGET Bar 3500 Puffs - Strawberry Watermelon Hard Candy": 4300,
  "IGET Bar Box (10 pcs)": 40500,
  "IGET Bar Box Mixed Flavours (10 pcs)": 39999,
  "IGET Bar Bundle (5 pcs)": 19900,
  "IGET Bar Plus": 4900,
  "IGET Bar Plus 6000 Puffs - Grape Peach Ice": 4200,
  "IGET Bar Plus 6000 Puffs - × Mixed Flavours": 4499,
  "IGET Bar Plus Pod 6000 Puffs": 2900, // $29 a pod, as in the market's 10-pack
  "IGET Bar Plus Box Mixed Flavours (10 pcs)": 42900, // market $340
  "IGET Bar Plus Pod Box Mixed Flavours (10 pcs)": 25000, // market $290
  "IGET Bar Plus Pod Box Mixed Flavours (20 pcs)": 55900, // market $560
  "IGET Bar Plus Vape Kit Bundle (2 pcs)": 8900,
  "IGET Legend 4000 Puffs": 3999,
  "IGET Legend 4000 Puffs - Passion Fruit Watermelon Ice": 4500,
  "IGET Legend Box Mixed Flavours (10 pcs)": 39900,
  "IGET Legend Bundle (5 pcs)": 19900, // the $39 copy is a pricing error: five bars cost about $125-165
  "IGET Moon 5000 Puffs - Passion Fruit Lychee": 4999,
  "IGET Moon 5000 Puffs - Pomegranate Kiwi Ice": 4499,
  "IGET XXL Box Mixed Flavours (10 pcs)": 17900, // ten bars at $15-20 is $150-200, not $89
  "HQD Cuvie Slick 6000 - Blueberry Lemonade": 2500, // no listing; the store's other Cuvie Slick 6000s are $25
  "Lost Vape Centaurus B60 AIO Pod System Kit 1600mAh 5ml": 9800, // no listing
  "Freemax Mesh Pro Replacement Coils 3 pcs": 2200, // no listing; two of three copies
  "Lychee e-Liquid Juice - Skwezed": 3600, // a US store's US$22.99 is about A$35
  "5x Desserts Ferocious - 70/30 Shortfill Bundle": 6500, // a UK store's £34.99 is about A$68
  "Elev8 Hand Crafted Duff Jar": 9959, // no listing
  "16″ 9mm Preemo Clear Embossed Logo Beaker Bong": 9999, // no listing; $168.90 vs $99.99, worth checking
};

type Row = Awaited<ReturnType<typeof load>>[number];
async function load() {
  return prisma.product.findMany({
    where: { status: "active" },
    select: {
      id: true, slug: true, name: true, type: true, priceCents: true, regularPriceCents: true, puffs: true, volumeMl: true, nicotineMg: true, packSize: true,
      flavour: true, shortDescription: true, metaTitle: true, metaDescription: true, wooId: true,
      brand: { select: { slug: true, name: true } },
      categories: { orderBy: { isPrimary: "desc" }, select: { categoryId: true, isPrimary: true, position: true, category: { select: { name: true, kind: true } } } },
    },
  });
}

const title = (p: Row) =>
  productTitle({ ...p, price: p.priceCents / 100, nicotineMg: p.nicotineMg ? Number(p.nicotineMg) : null, primary: p.categories[0]?.category ?? null });
// Prefer the plain address: no "-2" suffix, no "product-13" or pasted-URL slugs, then the shortest.
const slugCost = (s: string) =>
  (/-\d+$/.test(s) ? 10 : 0) + (/^(product-|https-)|^\d+$/.test(s) ? 100 : 0) + (/introduction|puffsv|-lce-/.test(s) ? 5 : 0) + s.length / 1000;
const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const rows = (await load()).map((p) => (RENAME[p.slug] ? { ...p, ...RENAME[p.slug] } : p));
const groups = new Map<string, Row[]>();
for (const p of rows) groups.set(title(p), [...(groups.get(title(p)) ?? []), p]);

const plan: { keep: Row; drop: Row[]; price: number }[] = [];
const undecided: string[] = [];
for (const [t, copies] of groups) {
  if (copies.length < 2 || t.endsWith(TITLE_SUFFIX)) continue; // unique, or awaiting legal review
  const name = copies[0].name;
  const prices = [...new Set(copies.map((c) => c.priceCents))];
  if (prices.length > 1 && PRICES[name] === undefined) {
    undecided.push(`${JSON.stringify(name)}: ${copies.map((c) => `${dollars(c.priceCents)} (${c.slug})`).join(", ")}`);
    continue;
  }
  const price = prices.length > 1 ? PRICES[name] : prices[0];
  const candidates = copies.filter((c) => c.priceCents === price);
  if (!candidates.length) throw new Error(`${name}: no copy is priced ${dollars(price)}`);
  const keep = [...candidates].sort((a, b) => slugCost(a.slug) - slugCost(b.slug) || a.slug.localeCompare(b.slug))[0];
  plan.push({ keep, drop: copies.filter((c) => c !== keep), price });
}
if (undecided.length) {
  console.error(`Decide a price for these (PRICES):\n${undecided.join("\n")}`);
  process.exit(1);
}

for (const g of plan) console.log(`keep ${g.keep.slug} ${dollars(g.price)}  <- ${g.drop.map((d) => d.slug).join(", ")}`);
const dropped = plan.flatMap((g) => g.drop);
console.log(`\n${plan.length} sets, ${dropped.length} copies to archive, ${Object.keys(RENAME).length} renamed.`);

// What the store will list afterwards: every title unique (other than products awaiting review).
const after = new Map<string, number>();
for (const p of rows) {
  const t = title(p);
  if (!dropped.includes(p) && !t.endsWith(TITLE_SUFFIX)) after.set(t, (after.get(t) ?? 0) + 1);
}
const clashes = [...after].filter(([, n]) => n > 1);
if (clashes.length) throw new Error(`still shared: ${clashes.map(([t]) => t).join(" | ")}`);
console.log("Every title is unique afterwards.");

if (!apply) {
  console.log("\nDry run. Add --apply to change the database.");
} else {
  const record: Record<string, string> = JSON.parse(readFileSync(RECORD, { encoding: "utf8", flag: "a+" }) || "{}");
  for (const g of plan) {
    const owned = new Set(g.keep.categories.map((c) => c.categoryId));
    const extra = g.drop.flatMap((d) => d.categories).filter((c) => !owned.has(c.categoryId) && owned.add(c.categoryId));
    await prisma.$transaction([
      ...extra.map((c) => prisma.productCategory.create({ data: { productId: g.keep.id, categoryId: c.categoryId, isPrimary: false, position: c.position } })),
      prisma.product.updateMany({ where: { id: { in: g.drop.map((d) => d.id) } }, data: { status: "archived" } }),
    ]);
    for (const d of g.drop) record[d.slug] = g.keep.slug;
  }
  for (const [slug, r] of Object.entries(RENAME)) await prisma.product.update({ where: { slug }, data: r });
  writeFileSync(RECORD, `${JSON.stringify(Object.fromEntries(Object.entries(record).sort()), null, 2)}\n`);
  console.log(`\nApplied. ${Object.keys(record).length} old addresses recorded in ${path.relative(process.cwd(), RECORD)}.`);
}
await prisma.$disconnect();
