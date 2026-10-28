// One-off clean-up (28 Oct 2026): product addresses the WooCommerce import left messy get the address their
// name gives (the admin's slugify), and the old one 301s to it through prisma/data/catalog/product-redirects.json.
// Messy: a copy suffix the name doesn't have ("…-2"), an encoded character (16″ as "16%e2%80%b3"), a
// WooCommerce placeholder ("product", "product-13", a pasted URL) or a typo ("cuive", "lce").
// A name whose address is already taken is left as it is and reported. THC and CBD products awaiting legal
// review are left alone.
//
// usage: node --env-file=.env.local --conditions=react-server --import tsx scripts/catalog/clean-slugs.mts [--apply]
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/admin/slug";
import { productTitle, TITLE_SUFFIX } from "@/lib/seo";

const apply = process.argv.includes("--apply");
const RECORD = path.join(process.cwd(), "prisma", "data", "catalog", "product-redirects.json");

// 16″ -> "16-inch": slugify would drop the mark and leave a bare number.
const ideal = (name: string) => slugify(name.replace(/(\d)\s*(?:[″"”]|′′)/g, "$1-inch "));
// Words in the old address the new one must keep. If one goes missing, the name probably lost it in the import
// ("alibarbar-pandora-7000-puff-ribena-2" for a product named "… - Pandora"): fix the name first.
// The old address is read the way the new one is made (16%e2%80%b3 -> 16-inch); "10pcs" matches "10-pcs", and
// the import's stray trailing "v" ("bluev", "puffsv") doesn't count as a word.
const NOISE = /^(\d+|puffs?|vapes?|product|https|com|bestvapeshopaustralia|introduction|lce|cuive|inch)$/;
const lostWords = (from: string, to: string) => {
  const kept = (w: string) => to.split("-").includes(w) || to.replace(/-/g, "").includes(w) || (w.endsWith("v") && to.includes(w.slice(0, -1)));
  return ideal(decodeURIComponent(from)).split("-").filter((w) => !NOISE.test(w) && !kept(w));
};
const messy = (slug: string, name: string) => {
  const suffix = slug.match(/-\d{1,2}$/)?.[0];
  return (
    (Boolean(suffix) && !ideal(name).endsWith(suffix!)) ||
    slug.includes("%") ||
    /^(product(-\d+)?|https-.*)$/.test(slug) ||
    /cuive|-lce-|puffsv|introduction/.test(slug)
  );
};

const all = await prisma.product.findMany({
  select: {
    id: true, slug: true, name: true, status: true, type: true, nicotineMg: true, priceCents: true, puffs: true, volumeMl: true, packSize: true,
    flavour: true, shortDescription: true, metaTitle: true, metaDescription: true, brand: { select: { slug: true, name: true } },
  },
});
const bySlug = new Map(all.map((p) => [p.slug, p]));
const moves: { id: string; from: string; to: string }[] = [];
// A copy archived by merge-duplicates.mts may hold the clean address: it moves aside to "…-archived".
const asides: { id: string; from: string; to: string }[] = [];
const stuck: string[] = [];
for (const p of all) {
  if (p.status !== "active" || !messy(p.slug, p.name)) continue;
  const reviewed = productTitle({ ...p, price: p.priceCents / 100, nicotineMg: p.nicotineMg ? Number(p.nicotineMg) : null, primary: null }).endsWith(TITLE_SUFFIX);
  if (reviewed) continue;
  const to = ideal(p.name);
  const lost = lostWords(p.slug, to);
  if (!to || lost.length) {
    stuck.push(`${p.slug} -> ${to}: the name doesn't say "${lost.join(" ")}"; check the product name`);
    continue;
  }
  const holder = bySlug.get(to);
  if (holder && holder.status !== "archived") {
    stuck.push(`${p.slug} -> ${to}: taken by a ${holder.status} product`);
    continue;
  }
  if (holder) {
    const aside = `${to}-archived`;
    if (bySlug.has(aside)) throw new Error(`${aside} already exists`);
    asides.push({ id: holder.id, from: to, to: aside });
    bySlug.set(aside, holder);
  }
  bySlug.set(to, p);
  moves.push({ id: p.id, from: p.slug, to });
}

for (const m of moves) console.log(`${m.from}  ->  ${m.to}`);
console.log(`\n${moves.length} addresses to clean (${asides.length} freed from archived copies), ${stuck.length} left:`);
for (const s of stuck) console.log(`  ${s}`);

if (!apply) {
  console.log("\nDry run. Add --apply to change the database.");
} else {
  const record: Record<string, string> = JSON.parse(readFileSync(RECORD, "utf8"));
  await prisma.$transaction([
    ...asides.map((a) => prisma.product.update({ where: { id: a.id }, data: { slug: a.to } })),
    ...moves.map((m) => prisma.product.update({ where: { id: m.id }, data: { slug: m.to } })),
  ]);
  for (const m of moves) {
    // Earlier redirects that pointed at the old address now go straight to the new one (no chains), and the
    // new address, now a live page, stops redirecting (it may have been an archived copy's).
    for (const [from, to] of Object.entries(record)) if (to === m.from) record[from] = m.to;
    record[m.from] = m.to;
    delete record[m.to];
  }
  writeFileSync(RECORD, `${JSON.stringify(Object.fromEntries(Object.entries(record).sort()), null, 2)}\n`);
  console.log(`\nApplied. ${Object.keys(record).length} old addresses in ${path.relative(process.cwd(), RECORD)}.`);
}
await prisma.$disconnect();
