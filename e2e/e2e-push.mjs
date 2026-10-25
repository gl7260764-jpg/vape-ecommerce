// Run against a production build: npm run build && npx next start -p 3100, then
//   E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… E2E_STAFF_EMAIL=… E2E_STAFF_PASSWORD=… node e2e/e2e-push.mjs http://localhost:3100
// (test owner and staff made with scripts/admin/create-admin.mts). Add a pretend subscription first:
//   node --conditions=react-server --import tsx e2e/push-fixture.mts add   (and "remove" after)
// Admin › Push notifications: the product list, the prefilled message, sending, history, staff refused.
// It sends a real push to every subscribed device, so it refuses to send unless the pretend one is the only one.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const OUT = "e2e/out"; // screenshots (git-ignored)
mkdirSync(OUT, { recursive: true });

const [base = "http://localhost:3100"] = process.argv.slice(2);
const OWNER = { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD };
const STAFF = { email: process.env.E2E_STAFF_EMAIL, password: process.env.E2E_STAFF_PASSWORD };
if (!OWNER.email || !OWNER.password || !STAFF.email || !STAFF.password) throw new Error("Set E2E_ADMIN_EMAIL/PASSWORD and E2E_STAFF_EMAIL/PASSWORD");
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const report = [];
const check = (name, ok, detail = "") => report.push({ check: name, ok: Boolean(ok), detail: String(detail).slice(0, 240) });
const errors = [];
const stamp = Date.now().toString(36);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function step(name, run) {
  try {
    await run();
  } catch (error) {
    check(name, false, error.message.split("\n")[0]);
  }
}
async function signIn(who, path) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("response", (r) => r.status() >= 500 && r.status() !== 503 && errors.push(`${r.status()} ${r.url()}`));
  await page.goto(base + `/admin/login?next=${encodeURIComponent(path)}`, { waitUntil: "load" });
  await page.fill("#email", who.email);
  await page.fill("#password", who.password);
  await page.click("button[type=submit]");
  await page.waitForURL(`**${path === "/admin/push" ? "/admin/push" : path}`, { timeout: 60000 });
  return { ctx, page };
}
// By CSS, not role: while the send box is open the page behind is aria-hidden (a modal dialog).
const historyRows = (p) => p.locator('[aria-label="Sent"] li');
const pushesSent = async (p) => Number((await p.getByText("Pushes sent", { exact: true }).locator("xpath=preceding-sibling::span[1]").innerText()).replace(/\D/g, ""));

const { ctx, page: ap } = await signIn(OWNER, "/admin/push");

await step("the page lists products and the device count", async () => {
  await ap.getByRole("heading", { name: "Push notifications" }).waitFor({ timeout: 20000 });
  await ap.getByRole("button", { name: /^Push / }).first().waitFor({ timeout: 20000 }); // the list streams in after the header
  const text = await ap.locator("body").innerText();
  const pushes = await ap.getByRole("button", { name: /^Push / }).count();
  check("the page lists products and the device count", /Notifications on/.test(text) && pushes > 0, `${pushes} push buttons`);
  await ap.goto(base + "/admin/push?q=banana", { waitUntil: "load" });
  await ap.getByRole("button", { name: /^Push / }).first().waitFor({ timeout: 20000 });
  const names = await ap.getByRole("button", { name: /^Push / }).evaluateAll((b) => b.map((x) => x.getAttribute("aria-label")));
  check("searching narrows the list", names.length > 0 && names.every((n) => /banana/i.test(n)), names.slice(0, 3).join(" | "));
});

let productName = "";
await step("Push prefills the title and message", async () => {
  const button = ap.getByRole("button", { name: /^Push / }).first();
  productName = (await button.getAttribute("aria-label")).replace(/^Push /, "");
  await button.click();
  const dialog = ap.getByRole("dialog");
  await dialog.waitFor({ timeout: 10000 });
  const title = await dialog.getByLabel("Title").inputValue();
  const message = await dialog.getByLabel("Message").inputValue();
  const preview = dialog.getByTestId("push-preview");
  const previewText = await preview.innerText();
  const photo = await preview.locator("img").count();
  check("Push prefills the title and message", title === `Just in: ${productName}` && /^\$\d+\.\d{2}\. Tap to see it\.$/.test(message), `${title} | ${message}`);
  check("the preview shows the message with the product photo", previewText.includes(title) && photo > 0, previewText.replace(/\s+/g, " "));
  await ap.screenshot({ path: `${OUT}/push-dialog.png` });
  await dialog.getByLabel("Title").fill(`Just in: ${productName} ${stamp}`);
});

await step("sending records it in the history", async () => {
  const sentBefore = await pushesSent(ap);
  const dialog = ap.getByRole("dialog");
  const send = dialog.getByRole("button", { name: /^Send to \d+ devices?$/ });
  const label = (await send.innerText()).trim();
  if (label !== "Send to 1 device") throw new Error(`refusing to send: "${label}" would reach real devices (only the pretend one should be subscribed)`);
  await send.dblclick(); // a double click must still send once
  await ap.keyboard.press("Escape"); // and the box can't be closed mid-send, then sent again
  check("the send box stays open while sending", await dialog.isVisible());
  await ap.getByText(/^Sent to \d+ devices?/).first().waitFor({ timeout: 30000 });
  const rows = historyRows(ap);
  const mine = rows.filter({ hasText: stamp }); // the history shows the last 20, so count this run's rows
  await mine.first().waitFor({ timeout: 20000 }); // the history refreshes a moment after the toast
  await sleep(2500); // and stays at one new row
  const first = await rows.first().innerText();
  check("sending records it in the history", first.includes(`${stamp}`) && first.includes(productName) && /delivered/.test(first), first.replace(/\s+/g, " "));
  check("send can't be pressed twice", (await mine.count()) === 1, `${await mine.count()} rows from this run`);
  const sentAfter = await pushesSent(ap);
  check("Pushes sent goes up by one", sentAfter === sentBefore + 1, `${sentBefore} -> ${sentAfter}`);
});

await step("a phone shows when a product was last pushed", async () => {
  await ap.setViewportSize({ width: 390, height: 844 });
  await ap.goto(base + `/admin/push?q=${encodeURIComponent(productName)}`, { waitUntil: "load" });
  const push = ap.getByRole("button", { name: `Push ${productName}`, exact: true });
  await push.waitFor({ timeout: 20000 });
  const row = ap.locator("li").filter({ has: push });
  const shown = await row.getByText(/Sent today/).isVisible().catch(() => false);
  check("a phone shows when a product was last pushed", shown, (await row.innerText()).replace(/\s+/g, " "));
  await ap.screenshot({ path: `${OUT}/push-phone.png` });
});
await ctx.close();

await step("staff can't push", async () => {
  const { ctx: sctx, page: sp } = await signIn(STAFF, "/admin/orders");
  const inNav = await sp.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Push notifications" }).count();
  await sp.goto(base + "/admin/push", { waitUntil: "load" });
  await sp.waitForURL((u) => !u.pathname.startsWith("/admin/push"), { timeout: 15000 }).catch(() => {});
  check("staff can't push", inNav === 0 && !new URL(sp.url()).pathname.startsWith("/admin/push"), `${sp.url()} nav=${inNav}`);
  await sctx.close();
});

await step("the opt-in says product news is included", async () => {
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await c.addInitScript(() => {
    try {
      localStorage.setItem("bvsa-age-confirmed", "yes");
      localStorage.setItem("bvsa-newsletter", JSON.stringify({ subscribed: true, shows: 0, lastClosedAt: null }));
    } catch {}
  });
  const p = await c.newPage();
  await p.goto(base + "/account", { waitUntil: "load" });
  await p.getByLabel("Email", { exact: true }).fill(`e2e.push.${stamp}@example.com`);
  await p.getByRole("button", { name: "Continue" }).click();
  const card = p.getByText("Get told when we reply, your order ships, or new products land.");
  const shown = await card.waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
  check("the opt-in says product news is included", shown);
  await c.close();
});

await browser.close();
check("no page errors or 5xx", errors.length === 0, errors.join(" | "));
for (const r of report) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.check}${r.ok ? "" : `  -> ${r.detail}`}`);
console.log(`\n${report.filter((r) => r.ok).length}/${report.length} passed`);
