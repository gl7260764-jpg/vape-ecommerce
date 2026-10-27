// Run against a production build: npm run build && npx next start -p 3100, then
//   node e2e/e2e-seo.mjs http://localhost:3100
// robots.txt and sitemap.xml for search engines (Google Search Console): every public page listed with the
// store's domain, nothing private, and the pages they list actually load.
const [base = "http://localhost:3100"] = process.argv.slice(2);
const SITE = "https://vapesupplieraustralia.com";
const report = [];
const check = (name, ok, detail = "") => report.push({ check: name, ok: Boolean(ok), detail: String(detail).slice(0, 300) });
const PRIVATE = ["/admin", "/api", "/account", "/checkout", "/order", "/orders"];

const robots = await fetch(`${base}/robots.txt`);
const robotsText = await robots.text();
check("robots.txt is served as text", robots.status === 200 && /text\/plain/.test(robots.headers.get("content-type") ?? ""), `${robots.status} ${robots.headers.get("content-type")}`);
check("robots.txt lets search engines in", /User-Agent: \*/i.test(robotsText) && /^Allow: \/$/m.test(robotsText), robotsText);
check("robots.txt keeps private pages out", PRIVATE.every((p) => new RegExp(`^Disallow: ${p}(/|$)`, "m").test(robotsText)), robotsText);
check("robots.txt points to the sitemap", robotsText.includes(`Sitemap: ${SITE}/sitemap.xml`), robotsText);

const sitemap = await fetch(`${base}/sitemap.xml`);
const xml = await sitemap.text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const paths = urls.map((u) => u.replace(SITE, "") || "/");
check("sitemap.xml is served as XML", sitemap.status === 200 && /xml/.test(sitemap.headers.get("content-type") ?? ""), `${sitemap.status} ${sitemap.headers.get("content-type")}`);
check("every address uses the store's domain", urls.length > 0 && urls.every((u) => u.startsWith(SITE)), urls.find((u) => !u.startsWith(SITE)));
check(
  "the main pages are listed",
  ["/", "/shop", "/categories", "/brands", "/contact"].every((p) => paths.includes(p)),
  paths.filter((p) => !p.includes("/", 1)).join(" ")
);
const products = paths.filter((p) => p.startsWith("/product/"));
const categories = paths.filter((p) => p.startsWith("/product-category/"));
const brands = paths.filter((p) => p.startsWith("/brand/"));
check("products, categories and brands are listed", products.length > 10 && categories.length > 0 && brands.length > 0, `${products.length} products, ${categories.length} categories, ${brands.length} brands`);
check("nothing private is listed", !paths.some((p) => PRIVATE.some((q) => p === q || p.startsWith(`${q}/`))), paths.filter((p) => PRIVATE.some((q) => p.startsWith(q))).join(" "));
check("no address is listed twice", new Set(urls).size === urls.length, urls.length - new Set(urls).size);
check("every address has a last-changed date", (xml.match(/<lastmod>/g) ?? []).length === urls.length, `${(xml.match(/<lastmod>/g) ?? []).length} of ${urls.length}`);

// A sample of what's listed actually loads (no redirects, no 404s).
// The first products by address are the ones imported with an encoded inch mark (16″ as "16%e2%80%b3").
const sample = [...new Set(["/", "/shop", "/categories", "/brands", "/contact", ...products.slice(0, 4), ...products.slice(-2), ...categories.slice(0, 3), ...brands.slice(0, 3)])];
const broken = [];
for (const p of sample) {
  const res = await fetch(base + p, { redirect: "manual" });
  // A missing page can still answer 200 (streamed "not found"): it carries a noindex tag.
  const noindex = res.status === 200 && /<meta name="robots" content="noindex"/.test(await res.text());
  if (res.status !== 200 || noindex) broken.push(`${p} ${noindex ? "not found (noindex)" : res.status}`);
}
check("the listed pages load", sample.length > 10 && broken.length === 0, broken.join(" | ") || `${sample.length} checked`);

// Google Search Console verifies the site with this tag on the home page (it must stay).
const home = await (await fetch(`${base}/`)).text();
check("the home page carries Google's verification tag", /<meta name="google-site-verification" content="FIpkve3vW-lPFJSxHkyWP9AwwXS8Ga1hMbqEV2kCq28"\/?>/.test(home), home.match(/<meta name="google-site-verification"[^>]*>/)?.[0] ?? "no tag");

for (const r of report) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.check}${r.ok ? "" : `  -> ${r.detail}`}`);
console.log(`\n${report.filter((r) => r.ok).length}/${report.length} passed`);
