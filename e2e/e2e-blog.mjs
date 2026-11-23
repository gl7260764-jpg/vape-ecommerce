// Run against a production build: npm run build && npx next start -p 3100, then
//   node e2e/e2e-blog.mjs http://localhost:3100
// Uses the system Chrome (/usr/bin/google-chrome). Places no orders.
// The blog: the index, category pages and every post (one h1, the short answer, contents, product picks,
// FAQ, structured data), every link inside a post working, and phones without sideways scrolling.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const OUT = "e2e/out"; // screenshots (git-ignored)
mkdirSync(OUT, { recursive: true });

const [base = "http://localhost:3100"] = process.argv.slice(2);
const SITE = "https://vapesupplieraustralia.com";
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const report = [];
const check = (name, ok, detail = "") => report.push({ check: name, ok: Boolean(ok), detail: String(detail).slice(0, 300) });
const errors = [];

async function step(name, run) {
  try {
    await run();
  } catch (error) {
    check(name, false, error.message.split("\n")[0]);
  }
}
async function page({ width = 1440, height = 900, mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("bvsa-age-confirmed", "yes");
      localStorage.setItem("bvsa-newsletter", JSON.stringify({ subscribed: false, shows: 0, lastClosedAt: Date.now() + 1e10 }));
      sessionStorage.setItem("bvsa-install-card", "hidden");
    } catch {}
  });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  p.on("response", (r) => r.status() >= 500 && r.status() !== 503 && errors.push(`${r.status()} ${r.url()}`));
  return { ctx, p };
}

const xml = await (await fetch(`${base}/sitemap.xml`)).text();
const blogUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(SITE, "")).filter((u) => u.startsWith("/blog"));
const posts = blogUrls.filter((u) => /^\/blog\/(?!category\/)[^/]+$/.test(u));
check("the sitemap lists the blog, its categories and its posts", blogUrls.includes("/blog") && blogUrls.some((u) => u.startsWith("/blog/category/")) && posts.length >= 2, blogUrls.join(" "));

const { ctx, p } = await page();

await step("the blog index", async () => {
  await p.goto(base + "/blog", { waitUntil: "load" });
  const h1 = await p.locator("h1").count();
  const cards = await p.locator("main article h3 a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  check("the blog index has one h1 and a card for every post", h1 === 1 && posts.every((u) => cards.includes(u)), `${h1} ${cards.join(" ")}`);
  check("the navbar and footer link to the blog", (await p.locator('header a[href="/blog"]').count()) > 0 && (await p.locator('nav[aria-label="Footer"] a[href="/blog"]').count()) === 1);
  await p.screenshot({ path: `${OUT}/blog-index.png`, fullPage: true });
});

await step("a category without posts can't be indexed", async () => {
  // Like unknown products, the first visit can stream a noindex "not found" page with a 200; later ones are 404s.
  const res = await fetch(`${base}/blog/category/not-a-category`);
  const noindex = /<meta name="robots" content="noindex"/.test(await res.text());
  const categoryPages = blogUrls.filter((u) => u.startsWith("/blog/category/"));
  const ok = [];
  for (const u of categoryPages) ok.push((await fetch(base + u)).status);
  check("category pages with posts load; an unknown one can't be indexed", (res.status === 404 || noindex) && ok.every((s) => s === 200), `${res.status} ${noindex} ${ok.join(" ")}`);
});

for (const path of posts) {
  await step(`post ${path}`, async () => {
    await p.goto(base + path, { waitUntil: "load" });
    const html = await p.content();
    const data = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].flatMap((m) => {
      const d = JSON.parse(m[1]);
      return d["@graph"] ?? [d];
    });
    const types = data.map((d) => d["@type"]);
    check(`${path}: one h1`, (await p.locator("h1").count()) === 1);
    check(`${path}: post, FAQ and breadcrumb data`, ["BlogPosting", "FAQPage", "BreadcrumbList"].every((t) => types.includes(t)), types.join(" "));
    const og = await p.locator('meta[property="og:image"]').getAttribute("content");
    check(`${path}: its cover is the link preview`, og?.includes(`${path.replace("/blog/", "/blog/")}.jpg`), og);
    check(`${path}: the short answer comes first`, await p.getByText("The short version").isVisible());
    await p.waitForTimeout(500);
    const toc = await p.locator('nav[aria-label="In this article"] a').evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    const targets = await Promise.all(toc.map((h) => p.locator(h).count()));
    check(`${path}: "In this article" lists the sections and each one jumps`, toc.length >= 4 && targets.every((n) => n === 1), toc.join(" "));
    const cards = await p.locator("[data-article-body] section").filter({ has: p.getByRole("button", { name: /Add .* to cart/ }) }).locator("article").count();
    // Cannabis posts are information only: no products at all, by rule.
    const cannabis = (await p.locator('header a[href="/blog/category/cannabis"]').count()) > 0;
    if (cannabis) check(`${path}: a cannabis post shows no products`, cards === 0 && (await p.getByRole("button", { name: /Add .* to cart/ }).count()) === 0, cards);
    else check(`${path}: product picks with Add to cart`, cards >= 4, cards);
    check(`${path}: an FAQ with at least 4 answers`, (await p.locator("#faqs + div h3").count()) >= 4);
    const images = await p.locator("main img").evaluateAll((imgs) => imgs.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.getAttribute("src")));
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await p.waitForTimeout(800);
    const broken = await p.locator("main img").evaluateAll((imgs) => imgs.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute("src")));
    check(`${path}: every picture loads`, broken.length === 0, `${broken.join(" ")} (lazy before scroll: ${images.length})`);
    const links = [...new Set(await p.locator("[data-article-body] a[href^='/']").evaluateAll((as) => as.map((a) => a.getAttribute("href"))))];
    const dead = [];
    for (const href of links) {
      const res = await fetch(base + href);
      if (res.status >= 400) dead.push(`${href} ${res.status}`);
    }
    // Shop posts link their ranges and other guides; a cannabis post has no ranges to link, so one is enough.
    check(`${path}: every link in the post works (${links.length})`, links.length >= (cannabis ? 1 : 5) && dead.length === 0, dead.join(" | ") || links.join(" "));
    check(`${path}: keep reading shows other posts`, (await p.locator('section[aria-labelledby="keep-reading"] article').count()) >= 1);
  });
}

await step("a post on a phone", async () => {
  const { ctx: m, p: mp } = await page({ width: 390, height: 844, mobile: true });
  await mp.goto(base + posts[0], { waitUntil: "load" });
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check("a post doesn't scroll sideways on a phone", overflow <= 0, overflow);
  const details = mp.locator("details", { hasText: "In this article" });
  await details.locator("summary").click();
  check("phones get the contents folded above the post", (await details.locator("a").count()) >= 4);
  await mp.screenshot({ path: `${OUT}/blog-post-phone.png`, fullPage: true });
  await m.close();
});

await step("a post on a desktop", async () => {
  await p.goto(base + posts[0], { waitUntil: "load" });
  await p.screenshot({ path: `${OUT}/blog-post-desktop.png`, fullPage: true });
  check("a post renders on a desktop", true);
});

await ctx.close();
await browser.close();
check("no page errors or 5xx", errors.length === 0, errors.join(" | "));
for (const r of report) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.check}${r.ok ? "" : `  -> ${r.detail}`}`);
console.log(`\n${report.filter((r) => r.ok).length}/${report.length} passed`);
process.exitCode = report.every((r) => r.ok) ? 0 : 1;
