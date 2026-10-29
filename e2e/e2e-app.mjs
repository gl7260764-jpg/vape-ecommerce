// Run against a production build: npm run build && npx next start -p 3100, then
//   node e2e/e2e-app.mjs http://localhost:3100 all
// Uses the system Chrome (/usr/bin/google-chrome). Test data uses @example.com emails; clear test sign-in
// limits between runs with: node --conditions=react-server --import tsx e2e/unlock.mts
// Install the app: the PWA shell, the install card / navbar icon / pop-up / steps, the app discount,
// notifications, and the admin's Visitors tags.
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const OUT = "e2e/out"; // screenshots (git-ignored)
mkdirSync(OUT, { recursive: true });

const [base = "http://localhost:3100", part = "all"] = process.argv.slice(2);
// A test owner made with scripts/admin/create-admin.mts, passed in the environment (never stored here):
//   E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… node e2e/<suite>.mjs
const OWNER = { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD };
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const report = [];
const check = (name, ok, detail = "") => report.push({ check: name, ok: Boolean(ok), detail: String(detail).slice(0, 240) });
const errors = [];
const stamp = Date.now().toString(36);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mail = (name) => `e2e.app.${stamp}.${name}@example.com`;

async function step(name, run) {
  try {
    await run();
  } catch (error) {
    check(name, false, error.message.split("\n")[0]);
  }
}
const watch = (p) => {
  p.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  p.on("response", (r) => r.status() >= 500 && r.status() !== 503 && errors.push(`${r.status()} ${r.url()}`));
  return p;
};

// ---------------------------------------------------------------------------
// The installable app
// ---------------------------------------------------------------------------
if (part === "all" || part === "pwa") {
  await step("the store is installable", async () => {
    const ctx = await browser.newContext();
    const p = watch(await ctx.newPage());
    const res = await p.goto(base + "/manifest.webmanifest");
    const m = await res.json();
    const icons = await Promise.all(m.icons.map(async (i) => (await ctx.request.get(base + i.src)).status()));
    check(
      "the manifest names the app and its icons",
      m.name === "Best Vape Shop Australia" && m.short_name === "Best Vape" && m.display === "standalone" && m.start_url === "/" &&
        ["192x192", "512x512"].every((s) => m.icons.some((i) => i.sizes === s && i.purpose === "any")) && m.icons.some((i) => i.purpose === "maskable") &&
        icons.every((s) => s === 200),
      JSON.stringify({ name: m.name, display: m.display, icons })
    );
    const sw = await ctx.request.get(base + "/sw.js");
    check("the service worker is served uncached", sw.status() === 200 && /no-cache/.test(sw.headers()["cache-control"] ?? ""), sw.headers()["cache-control"]);
    await p.goto(base + "/", { waitUntil: "load" });
    const linked = await p.evaluate(() => document.querySelector('link[rel="manifest"]')?.getAttribute("href"));
    await p.waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker?.ready, null, { timeout: 15000 });
    await p.reload({ waitUntil: "load" });
    const controlled = await p.evaluate(async () => {
      await navigator.serviceWorker.ready;
      return Boolean(navigator.serviceWorker.controller);
    });
    check("pages link the manifest and the service worker takes over", linked === "/manifest.webmanifest" && controlled, `${linked} ${controlled}`);
    await ctx.close();
    // Chrome's own verdict on whether it would offer to install the store (never in a private window,
    // so this one uses a normal profile).
    const profile = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), "bvsa-e2e-profile-")), { executablePath: "/usr/bin/google-chrome" });
    const pp = await profile.newPage();
    await pp.goto(base + "/", { waitUntil: "load" });
    await pp.evaluate(() => navigator.serviceWorker.ready);
    await pp.reload({ waitUntil: "load" });
    const cdp = await profile.newCDPSession(pp);
    const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
    check("Chrome says the store is installable", installabilityErrors.length === 0, JSON.stringify(installabilityErrors));
    await profile.close();
  });
}

// ---------------------------------------------------------------------------
// Helpers for the offers
// ---------------------------------------------------------------------------
const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
  desktop: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
};
// A visitor past the age check. newsletter: "later" keeps the newsletter pop-up away for this test,
// "subscribed" is a device that already subscribed, "fresh" lets it come. app: running as the installed app.
async function device({ viewport = { width: 1440, height: 900 }, newsletter = "later", app = false, userAgent, mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport, ...(userAgent ? { userAgent } : {}), ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.addInitScript(({ newsletter, app }) => {
    try {
      localStorage.setItem("bvsa-age-confirmed", "yes");
      if (newsletter === "later") localStorage.setItem("bvsa-newsletter", JSON.stringify({ subscribed: false, shows: 0, lastClosedAt: Date.now() + 1e10 }));
      if (newsletter === "subscribed") localStorage.setItem("bvsa-newsletter", JSON.stringify({ subscribed: true, shows: 0, lastClosedAt: null }));
    } catch {}
    if (app) {
      const real = window.matchMedia.bind(window);
      window.matchMedia = (q) => (q.includes("display-mode: standalone") ? { matches: true, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false } : real(q));
    }
  }, { newsletter, app });
  return { ctx, p: watch(await ctx.newPage()) };
}
const card = (p) => p.getByRole("complementary", { name: "Get the app" });
const installIcon = (p) => p.getByRole("button", { name: "Install the app" }).filter({ visible: true }).first();
const signInCard = (p) => p.getByRole("complementary", { name: "Keep your app discount" });
async function home(p) {
  await p.goto(base + "/", { waitUntil: "load" });
  await sleep(1500); // the offers appear once the page has checked the browser
}
async function subscribeInFooter(p, email) {
  await p.goto(base + "/", { waitUntil: "load" });
  await p.locator("#newsletter-email").fill(email);
  await p.locator("#newsletter-email").press("Enter");
  await p.getByText("You're in.").first().waitFor({ timeout: 20000 });
}
async function addToCart(p) {
  await p.goto(base + "/product/iget-legend-vape", { waitUntil: "load" });
  for (let i = 0; i < 5; i++) {
    await p.getByRole("button", { name: "Add to cart" }).filter({ visible: true }).first().click();
    const added = await p.waitForFunction(() => (JSON.parse(localStorage.getItem("bvsa-cart") ?? "{}").state?.lines ?? []).length > 0, null, { timeout: 3000 }).catch(() => null);
    if (added) break;
  }
}
async function fillCheckout(p, email) {
  await p.goto(base + "/checkout", { waitUntil: "load" });
  await p.waitForFunction(() => !document.querySelector("[aria-busy=true]"));
  await p.fill("#fullName", "Avery App");
  await p.fill("#email", email);
  await p.fill("#phone", "0412345678");
  await p.fill("#addressLine1", "1 Test Street");
  await p.fill("#suburb", "Sydney");
  await p.selectOption("#state", "NSW");
  await p.fill("#postcode", "2000");
  await p.fill("#notes", "E2E app test order, safe to delete");
}
const summary = (p) => p.locator("dl").filter({ hasText: "Subtotal", visible: true }).first();
async function signInAccount(p, email) {
  await p.goto(base + "/account", { waitUntil: "load" });
  await p.getByLabel("Email", { exact: true }).fill(email);
  await p.getByRole("button", { name: "Continue" }).click();
  await p.getByRole("button", { name: "Sign out on this device" }).waitFor({ timeout: 20000 });
}
async function adminSession() {
  if (!OWNER.email || !OWNER.password) throw new Error("Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (a test owner from scripts/admin/create-admin.mts)");
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = watch(await ctx.newPage());
  await page.goto(base + "/admin/login?next=%2Fadmin%2Fsettings%2Fnewsletter", { waitUntil: "load" });
  await page.fill("#email", OWNER.email);
  await page.fill("#password", OWNER.password);
  await page.click("button[type=submit]");
  await page.waitForURL("**/admin/settings/newsletter", { timeout: 60000 });
  return { ctx, page };
}
// Admin › Settings › Newsletter pop-up: timing for both pop-ups, and the install offers switch.
async function popupSettings(ap, { first, every, offers = true }) {
  await ap.goto(base + "/admin/settings/newsletter", { waitUntil: "load" });
  await ap.getByRole("heading", { name: "Newsletter pop-up" }).waitFor({ timeout: 20000 });
  const on = ap.getByRole("switch", { name: "Show the pop-up" });
  if (!(await on.isChecked())) await on.click({ force: true });
  const offersSwitch = ap.getByRole("switch", { name: "Show the app install card and pop-up" });
  if ((await offersSwitch.isChecked()) !== offers) await offersSwitch.click({ force: true });
  await ap.getByLabel("First show after (seconds)").fill(String(first));
  await ap.getByLabel("If they close it, show it again every (seconds)").fill(String(every));
  await ap.getByRole("radio", { name: "Until they subscribe" }).check({ force: true });
  await ap.getByRole("button", { name: "Save" }).click();
  await ap.getByText("Pop-up settings saved").first().waitFor({ timeout: 20000 });
}

// ---------------------------------------------------------------------------
// The install offers
// ---------------------------------------------------------------------------
if (part === "all" || part === "offers") {
  const { ctx: actx, page: ap } = await adminSession();
  await popupSettings(ap, { first: 1, every: 3 });

  await step("the card shows on a first visit", async () => {
    for (const [name, viewport] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
      const { ctx, p } = await device({ viewport, mobile: name === "phone" });
      await home(p);
      const c = card(p);
      await c.waitFor({ timeout: 10000 });
      const text = await c.innerText();
      const box = await c.boundingBox();
      const isDialog = await p.locator('[role="dialog"]').filter({ hasText: "Get the app, get 10% off" }).count();
      check(`the card shows on a first visit (${name})`, text.includes("Get the app, get 10% off") && text.includes("Faster ordering and order updates.") && box.x >= 0 && box.x + box.width <= viewport.width && !isDialog, text.replace(/\s+/g, " "));
      await p.screenshot({ path: `${OUT}/app-card-${name}.png` });
      await ctx.close();
    }
  });

  await step("✕ hides the card for the visit", async () => {
    const { ctx, p } = await device();
    await home(p);
    await card(p).getByRole("button", { name: "Close" }).click();
    await card(p).waitFor({ state: "detached", timeout: 5000 });
    await home(p);
    const stillGone = (await card(p).count()) === 0;
    await ctx.close();
    const { ctx: c2, p: p2 } = await device();
    await home(p2);
    const back = await card(p2).waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    check("✕ hides the card for the visit", stillGone && back, `${stillGone} ${back}`);
    await c2.close();
  });

  await step("the navbar install icon pulses", async () => {
    const { ctx, p } = await device();
    await home(p);
    await installIcon(p).waitFor({ timeout: 10000 });
    const pulses = await installIcon(p).locator(".motion-safe\\:animate-ping, .animate-ping").count();
    check("the navbar install icon pulses", pulses > 0, pulses);
    await ctx.close();
  });

  await step("Install shows the right steps", async () => {
    const cases = [
      ["browser menu", {}, /Install Best Vape/, "Install app"],
      ["iPhone", { userAgent: UA.iphone, viewport: { width: 390, height: 844 }, mobile: true }, /Add Best Vape to your Home Screen/, "Add to Home Screen"],
      ["Mac Safari", { userAgent: UA.macSafari }, /Add Best Vape to your Dock/, "Add to Dock"],
    ];
    for (const [name, opts, title, words] of cases) {
      const { ctx, p } = await device(opts);
      await home(p);
      await installIcon(p).click();
      const guide = p.getByRole("dialog", { name: title });
      const shown = await guide.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
      const text = shown ? await guide.innerText() : "";
      check(`Install shows the steps for ${name}`, shown && text.includes(words), text.replace(/\s+/g, " ").slice(0, 160));
      if (name === "iPhone") await p.screenshot({ path: OUT + "/app-guide-iphone.png" });
      await ctx.close();
    }
  });

  await step("subscribing swaps the card for the install pop-up", async () => {
    const { ctx, p } = await device();
    await subscribeInFooter(p, mail("swap"));
    await sleep(1000);
    const cardGone = (await card(p).count()) === 0;
    const popup = p.getByRole("dialog", { name: "Install the app and make it 20% off" });
    await popup.waitFor({ timeout: 10000 });
    const text = await popup.innerText();
    await p.screenshot({ path: OUT + "/app-popup-desktop.png" });
    check(
      "subscribing swaps the card for the install pop-up",
      cardGone && ["YOU'RE SUBSCRIBED", "20% off your next order (10% + 10%)", "Notifications for replies, orders and new products", "One tap from your home screen", "Install the app", "Not now"].every((t) => text.includes(t)),
      text.replace(/\s+/g, " ")
    );
    await popup.getByRole("button", { name: "Not now" }).click();
    await popup.waitFor({ state: "detached", timeout: 5000 });
    const back = await popup.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    check("the install pop-up comes back on the newsletter timing", back);
    await ctx.close();
  });

  await step("the card never blocks the newsletter pop-up", async () => {
    const { ctx, p } = await device({ newsletter: "fresh" });
    await p.goto(base + "/", { waitUntil: "load" });
    const pop = p.getByRole("dialog", { name: "Get 10% off your next order" });
    await pop.waitFor({ timeout: 15000 });
    await pop.getByLabel("Your email").fill(mail("both"));
    await pop.getByRole("button", { name: "Subscribe and save 10%" }).click();
    const ok = await p.getByRole("dialog").filter({ hasText: "You're in!" }).waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
    check("the card never blocks the newsletter pop-up", ok);
    await ctx.close();
  });

  await step("inside the app no offers, and it asks to sign in once", async () => {
    const { ctx, p } = await device({ app: true, newsletter: "subscribed", userAgent: UA.desktop });
    await home(p);
    await sleep(2500);
    const none = (await card(p).count()) === 0 && (await p.getByRole("button", { name: "Install the app" }).count()) === 0 && (await p.getByRole("dialog").count()) === 0;
    check("inside the app no install offers", none);
    const ask = signInCard(p);
    await ask.waitFor({ timeout: 10000 });
    const askText = await ask.innerText();
    check("the app asks to sign in once", askText.includes("Sign in with your email to keep your app's 10%"), askText.replace(/\s+/g, " "));
    const E = mail("appsignin");
    await ask.getByRole("link", { name: "Open your account" }).click();
    await p.waitForURL("**/account", { timeout: 15000 });
    await signInAccount(p, E);
    await home(p);
    check("it doesn't ask again", (await signInCard(p).count()) === 0);
    await ctx.close();
    // In a normal browser later, the same email (subscribed) gets the app's 10% too.
    const { ctx: c2, p: p2 } = await device();
    await subscribeInFooter(p2, E);
    await addToCart(p2);
    await fillCheckout(p2, E);
    const twenty = await summary(p2).getByText("Newsletter + app discount (20%)").waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
    check("signing in inside the app gives the email the app's 10% everywhere", twenty, (await summary(p2).innerText()).replace(/\s+/g, " "));
    await c2.close();
  });

  await step("an installed app's order gets 20% when subscribed", async () => {
    const { ctx, p } = await device({ app: true, newsletter: "subscribed", userAgent: UA.desktop });
    await home(p); // records the install for this device
    const E = mail("apporder");
    await subscribeInFooter(p, E);
    await addToCart(p);
    await fillCheckout(p, E);
    const twenty = await summary(p).getByText("Newsletter + app discount (20%)").waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
    check("an installed app's order gets 20% when subscribed", twenty, (await summary(p).innerText()).replace(/\s+/g, " "));
    await ctx.close();
  });

  await step("plain offers after the discount is used", async () => {
    const F = mail("used");
    const { ctx, p } = await device();
    await subscribeInFooter(p, F);
    await addToCart(p);
    await fillCheckout(p, F);
    await summary(p).getByText("Newsletter discount (10%)").waitFor({ timeout: 20000 });
    await p.getByRole("button", { name: /Place order/ }).click();
    await p.waitForURL("**/order/**", { timeout: 30000 });
    await ctx.close();
    const { ctx: c2, p: p2 } = await device();
    await signInAccount(p2, F);
    await home(p2);
    await card(p2).waitFor({ timeout: 10000 });
    const text = await card(p2).innerText();
    check("plain offers after the discount is used", text.includes("Get the app") && !text.includes("10%"), text.replace(/\s+/g, " "));
    await c2.close();
  });

  await step("never on checkout", async () => {
    const { ctx, p } = await device();
    await p.goto(base + "/checkout", { waitUntil: "load" });
    await sleep(2500);
    check("never on checkout", (await card(p).count()) === 0 && (await p.getByRole("button", { name: "Install the app" }).count()) === 0);
    await ctx.close();
  });

  await step("switched off, no offers", async () => {
    await popupSettings(ap, { first: 1, every: 3, offers: false });
    const { ctx, p } = await device({ newsletter: "subscribed" });
    await home(p);
    await sleep(3000);
    check("switched off, no offers", (await card(p).count()) === 0 && (await p.getByRole("button", { name: "Install the app" }).count()) === 0 && (await p.getByRole("dialog").count()) === 0);
    await ctx.close();
  });

  await popupSettings(ap, { first: 8, every: 10, offers: true }); // the owner's defaults
  await actx.close();
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
if (part === "all" || part === "push") {
  await step("the account page offers notifications", async () => {
    const { ctx, p } = await device({ newsletter: "subscribed", userAgent: UA.desktop });
    await ctx.grantPermissions(["notifications"], { origin: base });
    await signInAccount(p, mail("push"));
    const button = p.getByRole("button", { name: "Turn on notifications" });
    const offered = await button.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    check("the account page offers notifications", offered);
    if (offered) {
      await button.click();
      // Headless Chrome may have no push service to subscribe to; when it does, the card says it's on.
      const on = await p.getByText("On for this device").waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
      console.log("INFO subscribe in headless Chrome:", on ? "worked" : "no push service here");
      if (on) check("turning notifications on saves it for this device", true);
    }
    await ctx.close();
  });

  await step("notifications hidden without support", async () => {
    const { ctx, p } = await device({ newsletter: "subscribed" });
    await ctx.addInitScript(() => {
      delete window.PushManager;
    });
    await signInAccount(p, mail("nopush"));
    await sleep(1500);
    check("notifications hidden without support", (await p.getByRole("heading", { name: "Notifications" }).count()) === 0);
    await ctx.close();
  });

  await step("the app offers notifications once", async () => {
    const { ctx, p } = await device({ app: true, newsletter: "subscribed", userAgent: UA.desktop });
    await signInAccount(p, mail("appnotify"));
    await home(p);
    const offer = p.getByRole("complementary", { name: "Turn on notifications" });
    const shown = await offer.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    if (shown) await offer.getByRole("button", { name: "Close" }).click();
    await home(p);
    check("the app offers notifications once", shown && (await offer.count()) === 0, shown);
    await ctx.close();
  });
}

// ---------------------------------------------------------------------------
// Admin › Visitors shows App and Notifications
// ---------------------------------------------------------------------------
if (part === "all" || part === "visitors") {
  await step("the Visitors page shows who installed the app", async () => {
    const E = mail("visitor");
    const { ctx, p } = await device({ app: true, newsletter: "subscribed", userAgent: UA.desktop });
    await home(p); // records the install
    await subscribeInFooter(p, E); // gives the visitor its email
    await sleep(2000);
    await ctx.close();
    const { ctx: actx, page: ap } = await adminSession();
    await ap.goto(base + "/admin/analytics/visitors?q=" + encodeURIComponent(E), { waitUntil: "load" });
    const row = ap.locator("table tbody tr").first();
    await row.waitFor({ timeout: 20000 });
    const rowText = await row.innerText();
    check("the visitor list tags the app", rowText.includes("App · Windows"), rowText.replace(/\s+/g, " "));
    await row.getByRole("link").first().click();
    await ap.waitForURL(/\/admin\/analytics\/visitors\/[\w-]+$/, { timeout: 20000 });
    await ap.getByText("Where and on what").waitFor({ timeout: 20000 }); // the visitor streams in after load
    const page = await ap.locator("body").innerText();
    check("the visitor page shows the app and the install event", /Installed the app/.test(page) && /App · Windows/.test(page) && /Installed \d/.test(page), page.replace(/\s+/g, " ").slice(0, 300));
    await actx.close();
  });
}

// ---------------------------------------------------------------------------
// Final review fixes
// ---------------------------------------------------------------------------
if (part === "all" || part === "fixes") {
  await step("a brand-new app records its install on its first load", async () => {
    const E = mail("firstload");
    const { ctx, p } = await device({ app: true, newsletter: "subscribed", userAgent: UA.desktop });
    await p.goto(base + "/", { waitUntil: "load" }); // one load: no analytics cookie yet when the app starts
    await sleep(9000); // the app retries while its first visit is stored
    await p.locator("#newsletter-email").fill(E); // same page, so the visitor gets an email to find it by
    await p.locator("#newsletter-email").press("Enter");
    await p.getByText("You're in.").first().waitFor({ timeout: 20000 });
    await ctx.close();
    const { ctx: actx, page: ap } = await adminSession();
    await ap.goto(base + "/admin/analytics/visitors?q=" + encodeURIComponent(E), { waitUntil: "load" });
    const row = ap.locator("table tbody tr").first();
    await row.waitFor({ timeout: 20000 });
    check("a brand-new app records its install on its first load", (await row.innerText()).includes("App · Windows"), (await row.innerText()).replace(/\s+/g, " "));
    await actx.close();
  });

  await step("no install offers once the app is installed", async () => {
    // Android and desktop Chrome: the installed app and the browser share cookies.
    const { ctx: appCtx, p: app } = await device({ app: true, userAgent: UA.desktop });
    await home(app);
    await sleep(6000); // the install is recorded
    const cookies = await appCtx.cookies();
    await appCtx.close();
    const { ctx, p } = await device({ userAgent: UA.desktop });
    await ctx.addCookies(cookies);
    await home(p);
    await sleep(2000);
    check("no install offers once the app is installed", (await card(p).count()) === 0 && (await p.getByRole("button", { name: "Install the app" }).count()) === 0);
    await ctx.close();
  });

  await step("the iPhone app keeps the status bar off the navbar", async () => {
    const { ctx, p } = await device();
    await p.goto(base + "/", { waitUntil: "load" });
    const style = await p.evaluate(() => document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.getAttribute("content"));
    check("the iPhone app keeps the status bar off the navbar", style === "black", style);
    await ctx.close();
  });
}

await browser.close();
check("no page errors or 5xx", errors.length === 0, errors.join(" | "));
for (const r of report) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.check}${r.ok ? "" : `  -> ${r.detail}`}`);
console.log(`\n${report.filter((r) => r.ok).length}/${report.length} passed`);
