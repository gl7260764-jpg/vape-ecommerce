// seo/urls.csv: every page in the live sitemap.xml, in the order worth asking Google to index them one by one
// (Search Console > URL Inspection > Request indexing allows about 10 a day). Hubs first, because Google
// finds the products through them: home and main pages, categories, blog, brands, then products.
//
// Re-run after a change is deployed (new products, categories or blog posts): it reads the live sitemap, so the
// list is exactly what Google is told about. Your "submitted" marks are kept.
// usage: npm run seo:urls
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { POSTS } from "@/content/blog/posts";
import { BLOG_CATEGORIES } from "@/lib/blog";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/site";

const FILE = path.join(process.cwd(), "seo", "urls.csv");
const HEADER = ["order", "url", "page_type", "name", "last_updated", "submitted", "submitted_date", "notes"] as const;

// --- what's in the sitemap now ------------------------------------------------------------------------------
// Read from the site itself: src/app/sitemap.ts runs on Next's cache and can't run outside the app.
const xml = await fetch(`${SITE_URL}/sitemap.xml`, { cache: "no-store" }).then((r) => {
  if (!r.ok) throw new Error(`sitemap.xml returned ${r.status}`);
  return r.text();
});
const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, block]) => ({
  url: block.match(/<loc>([^<]+)<\/loc>/)?.[1].trim() ?? "",
  lastModified: block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1].trim(),
  priority: Number(block.match(/<priority>([^<]+)<\/priority>/)?.[1] ?? 0),
})).filter((e) => e.url);
const [products, categories, brands] = await Promise.all([
  prisma.product.findMany({ where: { status: "active" }, select: { slug: true, name: true } }),
  prisma.category.findMany({ select: { slug: true, name: true, brand: { select: { slug: true } }, _count: { select: { products: { where: { product: { status: "active" } } } } } } }),
  prisma.brand.findMany({ select: { slug: true, name: true } }),
]);
const names = new Map<string, string>([
  ["/", "Home"],
  ["/shop", "Shop all"],
  ["/categories", "All categories"],
  ["/brands", "All brands"],
  ["/blog", "Blog"],
  ["/contact", "Contact"],
  ["/about-us", "About us"],
  ["/shipping", "Shipping"],
  ...products.map((p) => [`/product/${p.slug}`, p.name] as [string, string]),
  ...categories.map((c) => [`/product-category/${c.slug}`, c.name] as [string, string]),
  ...brands.map((b) => [`/brand/${b.slug}`, b.name] as [string, string]),
  ...POSTS.map((p) => [`/blog/${p.slug}`, p.title] as [string, string]),
  ...BLOG_CATEGORIES.map((c) => [`/blog/category/${c.slug}`, `Blog: ${c.name}`] as [string, string]),
]);

const typeOf = (p: string) =>
  p === "/" ? "home"
  : ["/shop", "/categories", "/brands", "/blog"].includes(p) ? "main page"
  : p.startsWith("/product-category/") ? "category"
  : p.startsWith("/blog/category/") ? "blog category"
  : p.startsWith("/blog/") ? "blog post"
  : p.startsWith("/brand/") ? "brand"
  : p.startsWith("/product/") ? "product"
  : "info page";
const RANK = ["home", "main page", "category", "blog post", "blog category", "brand", "product", "info page"];

// The main shelves first among categories, then the busiest; THC/CBD pages under legal review go last in their group.
const SHELF_FIRST = ["disposable-vapes", "bulk-buy", "iget-vapes-bulk-buy", "e-liquids"];
const size = new Map(categories.map((c) => [`/product-category/${c.slug}`, c._count.products]));
const ON_HOLD = /muha|cbd|cbg|thc|hhc|ace-ultra|\/brand\/ace$/i;
const onHold = (url: string, name: string) => ON_HOLD.test(url) || ON_HOLD.test(name);
const weight = (p: string) => {
  const shelf = SHELF_FIRST.indexOf(p.replace("/product-category/", ""));
  return shelf >= 0 ? 100_000 - shelf : (size.get(p) ?? 0);
};

const rows = entries
  .map((e) => {
    const p = e.url.slice(SITE_URL.length) || "/";
    const updated = e.lastModified ? new Date(e.lastModified).toISOString().slice(0, 10) : "";
    const name = names.get(p) ?? "";
    return { url: e.url, page_type: typeOf(p), name, last_updated: updated, priority: e.priority ?? 0, hold: onHold(e.url, name) ? 1 : 0, weight: weight(p) };
  })
  // Within a kind: on-hold pages last, then main shelves and bigger categories, the sitemap's priority, then
  // newest first (fresh blog posts and products before old ones).
  .sort(
    (a, b) =>
      RANK.indexOf(a.page_type) - RANK.indexOf(b.page_type) ||
      a.hold - b.hold ||
      b.weight - a.weight ||
      b.priority - a.priority ||
      b.last_updated.localeCompare(a.last_updated) ||
      a.url.localeCompare(b.url),
  );

// --- keep what was already marked as submitted -----------------------------------------------------------
const parse = (line: string) => {
  const out: string[] = [];
  let cur = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
};
const kept = new Map<string, { submitted: string; submitted_date: string; notes: string }>();
if (existsSync(FILE)) {
  const [head, ...lines] = readFileSync(FILE, "utf8").split(/\r?\n/).filter(Boolean);
  const cols = parse(head);
  for (const line of lines) {
    const v = parse(line);
    const get = (k: string) => v[cols.indexOf(k)] ?? "";
    kept.set(get("url"), { submitted: get("submitted"), submitted_date: get("submitted_date"), notes: get("notes") });
  }
}

const cell = (s: string | number) => (/[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
const csv = [
  HEADER.join(","),
  ...rows.map((r, i) => {
    const k = kept.get(r.url) ?? { submitted: "", submitted_date: "", notes: "" };
    return [i + 1, r.url, r.page_type, r.name, r.last_updated, k.submitted, k.submitted_date, k.notes].map(cell).join(",");
  }),
].join("\n");
mkdirSync(path.dirname(FILE), { recursive: true });
writeFileSync(FILE, `${csv}\n`);

const added = rows.filter((r) => kept.size && !kept.has(r.url)).length;
const gone = [...kept.keys()].filter((u) => !rows.some((r) => r.url === u)).length;
const count = (t: string) => rows.filter((r) => r.page_type === t).length;
console.log(`seo/urls.csv: ${rows.length} URLs (${RANK.map((t) => `${count(t)} ${t}`).join(", ")})`);
if (kept.size) console.log(`new since last time: ${added}, no longer in the sitemap: ${gone}, marked submitted: ${[...kept.values()].filter((k) => k.submitted).length}`);
await prisma.$disconnect();
