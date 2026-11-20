// Read-only: renders every live product's, category's and brand's <title> and meta description with
// src/lib/seo.ts and reports what search results would show: lengths over the limit, duplicates, samples.
// usage: node --env-file=.env.local --conditions=react-server --import tsx scripts/seo/audit-meta.mts [--json out.json]
import { writeFileSync } from "node:fs";
import { prisma } from "@/lib/db";
import { brandSeo, categorySeo, productDescription, productTitle, TITLE_SUFFIX, type ProductSeoInput } from "@/lib/seo";

const TITLE_MAX = 60;
const DESC_MAX = 160;

const products = await prisma.product.findMany({
  where: { status: "active" },
  select: {
    slug: true, name: true, type: true, priceCents: true, puffs: true, volumeMl: true, nicotineMg: true, packSize: true,
    flavour: true, shortDescription: true, metaTitle: true, metaDescription: true,
    brand: { select: { slug: true, name: true } },
    categories: { select: { isPrimary: true, category: { select: { name: true, kind: true } } } },
  },
});

const rows = products.map((p) => {
  const primary = p.categories.find((c) => c.isPrimary)?.category ?? p.categories[0]?.category ?? null;
  const seo: ProductSeoInput = {
    name: p.name, type: p.type, price: p.priceCents / 100, brand: p.brand, primary,
    puffs: p.puffs, volumeMl: p.volumeMl, nicotineMg: p.nicotineMg ? Number(p.nicotineMg) : null, packSize: p.packSize,
    flavour: p.flavour, shortDescription: p.shortDescription, metaTitle: p.metaTitle, metaDescription: p.metaDescription,
  };
  return { kind: "product", slug: p.slug, type: p.type as string, title: productTitle(seo), description: productDescription(seo) ?? "" };
});

const categories = await prisma.category.findMany({
  where: { isVisible: true },
  select: {
    slug: true, name: true, kind: true, tagline: true, metaTitle: true, metaDescription: true, brand: { select: { slug: true } },
    _count: { select: { products: { where: { product: { status: "active" } } } } },
  },
});
for (const c of categories) {
  const s = categorySeo({ slug: c.slug, kind: c.kind, name: c.name, count: c._count.products, fromPrice: null, tagline: c.tagline, brandSlug: c.brand?.slug ?? null, metaTitle: c.metaTitle, metaDescription: c.metaDescription });
  rows.push({ kind: "category", slug: c.slug, type: c.kind, title: typeof s.title === "string" ? `${s.title}${TITLE_SUFFIX}` : s.title.absolute, description: s.description ?? "" });
}
const brands = await prisma.brand.findMany({ select: { slug: true, name: true, _count: { select: { products: true } } } });
for (const b of brands) {
  const s = brandSeo({ name: b.name, slug: b.slug, count: b._count.products, fromPrice: null, ranges: [] });
  rows.push({ kind: "brand", slug: b.slug, type: "", title: `${s.title}${TITLE_SUFFIX}`, description: s.description });
}

const count = <T,>(xs: T[], key: (x: T) => string) => xs.reduce((m, x) => m.set(key(x), (m.get(key(x)) ?? 0) + 1), new Map<string, number>());
for (const kind of ["product", "category", "brand"]) {
  const rs = rows.filter((r) => r.kind === kind);
  const titles = count(rs, (r) => r.title);
  const descs = count(rs, (r) => r.description);
  const dupTitles = rs.filter((r) => (titles.get(r.title) ?? 0) > 1).length;
  const dupDescs = rs.filter((r) => (descs.get(r.description) ?? 0) > 1).length;
  console.log(
    `${kind}s: ${rs.length} | titles over ${TITLE_MAX}: ${rs.filter((r) => r.title.length > TITLE_MAX).length}` +
      ` | descriptions over ${DESC_MAX}: ${rs.filter((r) => r.description.length > DESC_MAX).length}, under 70: ${rs.filter((r) => r.description.length < 70).length}` +
      ` | sharing a title: ${dupTitles} | sharing a description: ${dupDescs}`,
  );
}
const byType = count(rows.filter((r) => r.kind === "product"), (r) => r.type);
console.log("products by type:", Object.fromEntries(byType));
const sample = (kind: string, n: number) => rows.filter((r) => r.kind === kind).sort(() => 0.5 - Math.random()).slice(0, n);
for (const r of [...sample("product", 12), ...sample("category", 5), ...sample("brand", 3)]) {
  console.log(`\n[${r.kind}${r.type ? `:${r.type}` : ""}] /${r.slug}\n  T(${r.title.length}) ${r.title}\n  D(${r.description.length}) ${r.description}`);
}
const out = process.argv.indexOf("--json");
if (out > 0) writeFileSync(process.argv[out + 1], JSON.stringify(rows, null, 1));
await prisma.$disconnect();
