// Run against a production build: npm run build && npx next start -p 3100, then
//   node e2e/e2e-about.mjs http://localhost:3100
// The About page: indexable with its own canonical, the store's details and structured data, listed in the
// sitemap, and reachable from the header (desktop and the mobile menu) and the footer.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const OUT = "e2e/out"; // screenshots (git-ignored)
mkdirSync(OUT, { recursive: true });

const [base = "http://localhost:3100"] = process.argv.slice(2);
const SITE = "https://vapesupplieraustralia.com";
const report = [];
const check = (name, ok, detail = "") => report.push({ check: name, ok: Boolean(ok), detail: String(detail).slice(0, 240) });
const errors = [];

async function step(name, run) {
  try {
    await run();
  } catch (error) {
    check(name, false, error.message.split("\n")[0]);
  }
}

// The page as search engines get it.
const res = await fetch(`${base}/about-us`);
const html = await res.text();
check("the page loads", res.status === 200, res.status);
check("it can be indexed", !/<meta name="robots" content="[^"]*noindex/.test(html), html.match(/<meta name="robots"[^>]*>/)?.[0]);
check("it has its own canonical", html.includes(`<link rel="canonical" href="${SITE}/about-us"/>`), html.match(/<link rel="canonical"[^>]*>/)?.[0] ?? "none");
check("it has its own title", /<title>About us \| Best Vape Shop Australia<\/title>/.test(html), html.match(/<title>[^<]*<\/title>/)?.[0]);
check("the H1 is About us", /<h1[^>]*>About us<\/h1>/.test(html), html.match(/<h1[^>]*>[^<]*<\/h1>/)?.[0]);
check(
  "the store's details are in the HTML",
  ["Business details", "Best Vape Shop Australia", "contact@vapesupplieraustralia.com", "+61 468 187 334"].every((s) => html.includes(s)),
  ""
);
const blocks = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => JSON.parse(m[1]));
const about = blocks.find((b) => b["@type"] === "AboutPage");
check(
  "structured data names the store",
  about?.mainEntity?.["@type"] === "OnlineStore" && about.mainEntity.url === SITE && about.mainEntity.telephone === "+61468187334",
  JSON.stringify(about ?? blocks.map((b) => b["@type"]))
);

const xml = await (await fetch(`${base}/sitemap.xml`)).text();
check("the sitemap lists it", xml.includes(`<loc>${SITE}/about-us</loc>`), "");

// The links to it, as a visitor past the age check.
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
async function device(viewport, mobile = false) {
  const ctx = await browser.newContext({ viewport, ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("bvsa-age-confirmed", "yes");
      localStorage.setItem("bvsa-newsletter", JSON.stringify({ subscribed: false, shows: 0, lastClosedAt: Date.now() + 1e10 }));
    } catch {}
  });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  p.on("response", (r) => r.status() >= 500 && errors.push(`${r.status()} ${r.url()}`));
  return { ctx, p };
}

// The desktop bar shows from 1024px, with two more links from 1280px: About must fit beside the icons at every width.
for (const width of [1024, 1280, 1440]) {
  await step(`the header links to it at ${width}px`, async () => {
    const { ctx, p } = await device({ width, height: 900 });
    await p.goto(`${base}/shop`);
    const nav = p.getByRole("navigation", { name: "Primary" });
    const about = nav.getByRole("link", { name: "About" });
    const shop = nav.getByRole("link", { name: "Shop" });
    const search = p.getByRole("button", { name: "Search", exact: true });
    const [a, s, q] = [await about.boundingBox(), await shop.boundingBox(), await search.boundingBox()];
    const fits = a && s && q && Math.abs(a.y - s.y) < 2 && a.x + a.width <= q.x;
    if (width === 1024) await p.screenshot({ path: `${OUT}/about-header-1024.png`, clip: { x: 0, y: 0, width, height: 90 } });
    await about.click();
    await p.waitForURL("**/about-us");
    check(`the header links to it at ${width}px`, fits && (await p.getByRole("heading", { level: 1, name: "About us" }).isVisible()), JSON.stringify({ a, s, q }));
    await ctx.close();
  });
}

await step("the mobile menu links to it", async () => {
  const { ctx, p } = await device({ width: 390, height: 844 }, true);
  await p.goto(`${base}/`);
  await p.getByRole("button", { name: "Open menu" }).click();
  await p.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "About" }).click();
  await p.waitForURL("**/about-us");
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await p.screenshot({ path: `${OUT}/about-mobile.png`, fullPage: true });
  check("the mobile menu links to it", await p.getByRole("heading", { level: 1, name: "About us" }).isVisible(), p.url());
  check("no sideways scroll on a phone", overflow <= 0, `${overflow}px`);
  await ctx.close();
});

await step("the footer links to it", async () => {
  const { ctx, p } = await device({ width: 1440, height: 900 });
  await p.goto(`${base}/contact`);
  await p.getByRole("navigation", { name: "Footer" }).getByRole("link", { name: "About us" }).click();
  await p.waitForURL("**/about-us");
  await p.screenshot({ path: `${OUT}/about-desktop.png`, fullPage: true });
  check("the footer links to it", await p.getByRole("heading", { level: 2, name: "Business details" }).isVisible(), p.url());
  await ctx.close();
});

await browser.close();
check("no page errors", errors.length === 0, errors.join(" | "));
for (const r of report) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.check}${r.ok ? "" : `  -> ${r.detail}`}`);
console.log(`\n${report.filter((r) => r.ok).length}/${report.length} passed`);
process.exitCode = report.every((r) => r.ok) ? 0 : 1;
