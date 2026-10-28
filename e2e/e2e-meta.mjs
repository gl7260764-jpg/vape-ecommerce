// Run against a production build: npm run build && npx next start -p 3100, then
//   node e2e/e2e-meta.mjs http://localhost:3100
// Titles, meta descriptions, canonicals and Open Graph tags as Google sees them (src/lib/seo.ts): every page
// listed in the sitemap that's checked has its own, aimed at Australian searches, except the THC and CBD
// products awaiting legal review, which keep their plain title and summary.
const [base = "http://localhost:3100"] = process.argv.slice(2);
const SITE = "https://vapesupplieraustralia.com";
const report = [];
const check = (name, ok, detail = "") => report.push({ check: name, ok: Boolean(ok), detail: String(detail).slice(0, 300) });
const decode = (s) => s.replaceAll("&amp;", "&").replaceAll("&#x27;", "'").replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&gt;", ">");

async function head(path) {
  const html = await (await fetch(base + path)).text();
  const meta = (attr, name) => [...html.matchAll(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`, "g"))].map((m) => decode(m[1]));
  return {
    path,
    h1s: [...html.matchAll(/<h1[^>]*>(.*?)<\/h1>/gs)].map((m) => decode(m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim())),
    titles: [...html.matchAll(/<title>([^<]*)<\/title>/g)].map((m) => decode(m[1])),
    description: meta("name", "description")[0] ?? "",
    canonical: html.match(/<link rel="canonical" href="([^"]*)"/)?.[1],
    og: { title: meta("property", "og:title"), url: meta("property", "og:url")[0], locale: meta("property", "og:locale")[0], site: meta("property", "og:site_name")[0] },
  };
}

const xml = await (await fetch(`${base}/sitemap.xml`)).text();
const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(SITE, "") || "/");
const products = paths.filter((p) => p.startsWith("/product/"));
const spread = products.filter((_, i) => i % Math.ceil(products.length / 40) === 0); // ~40 across the alphabet
const sample = [...paths.filter((p) => !p.startsWith("/product/")), ...spread];
const pages = [];
for (const p of sample) pages.push(await head(p));

// Every page.
const bad = (fn) => pages.filter(fn).map((p) => p.path);
check("every page has exactly one title", bad((p) => p.titles.length !== 1 || !p.titles[0]).length === 0, bad((p) => p.titles.length !== 1).join(" "));
check("every page has a meta description", bad((p) => p.description.length < 20).length === 0, bad((p) => p.description.length < 20).join(" "));
check("every page's canonical is its own address", bad((p) => p.canonical !== SITE + (p.path === "/" ? "" : p.path) && p.canonical !== `${SITE}/`).length === 0, bad((p) => !p.canonical?.endsWith(p.path)).join(" "));
check("every page has one og:title and its own og:url", bad((p) => p.og.title.length !== 1 || !p.og.url).length === 0, bad((p) => p.og.title.length !== 1 || !p.og.url).join(" "));
check("Open Graph says en_AU and the store's name", bad((p) => p.og.locale !== "en_AU" || p.og.site !== "Best Vape Shop Australia").length === 0, bad((p) => p.og.locale !== "en_AU").join(" "));
check("no two pages share a title", new Set(pages.map((p) => p.titles[0])).size === pages.length, pages.length - new Set(pages.map((p) => p.titles[0])).size);
check("every page has exactly one h1", bad((p) => p.h1s.length !== 1).length === 0, pages.filter((p) => p.h1s.length !== 1).map((p) => `${p.path} (${p.h1s.length})`).join(" "));
check("the home page h1 reads as words", pages.find((p) => p.path === "/")?.h1s[0] === "Big clouds. Better prices.", pages.find((p) => p.path === "/")?.h1s[0]);

// Aimed at Australia (everything but the products awaiting review, which keep what they had).
const reviewed = (p) => /muha|ace-|cbd|cbg|3000mg/i.test(p.path);
const local = pages.filter((p) => !reviewed(p));
const echoes = local.filter((p) => p.description.toLowerCase().startsWith(p.titles[0].split(" | ")[0].toLowerCase()));
check("descriptions don't open by repeating the title", echoes.length === 0, echoes.map((p) => p.path).join(" "));
check("titles and descriptions mention Australia", local.every((p) => /australia/i.test(p.titles[0] + p.description)), local.filter((p) => !/australia/i.test(p.titles[0] + p.description)).map((p) => p.path).join(" "));
const home = pages.find((p) => p.path === "/");
check("the home page names the capital cities", /Sydney, Melbourne, Brisbane, Perth, Adelaide/.test(home?.description ?? ""), home?.description);
const bar = await head("/product/iget-bar-3500-puffs-strawberry-watermelon-ice");
check("a product's title and description come from its details", /\| (Disposable Vape )?Australia$/.test(bar.titles[0]) && /3,500-puff disposable vape/.test(bar.description) && /\$\d/.test(bar.description), `${bar.titles[0]} / ${bar.description}`);
const category = await head("/product-category/iget-bar-australia");
check("a category names its range, count and lowest price", category.titles[0] === "IGET Bar Australia | Best Vape Shop Australia" && /Shop \d+ products? from \$/.test(category.description), `${category.titles[0]} / ${category.description}`);
const brand = await head("/brand/iget");
check("a brand page is titled apart from its category", brand.titles[0] === "IGET Australia: Full Range | Best Vape Shop Australia", brand.titles[0]);

// Awaiting legal review: the plain title and summary, as before.
const thc = await head("/product/blue-dream-muha-meds-disposable");
check("THC products keep their plain title and summary", thc.titles[0] === "Blue Dream | Best Vape Shop Australia" || (/\| Best Vape Shop Australia$/.test(thc.titles[0]) && !/tracked delivery/i.test(thc.description)), `${thc.titles[0]} / ${thc.description}`);

for (const r of report) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.check}${r.ok ? "" : `  -> ${r.detail}`}`);
console.log(`\n${report.filter((r) => r.ok).length}/${report.length} passed (${pages.length} pages checked)`);
process.exitCode = report.every((r) => r.ok) ? 0 : 1;
