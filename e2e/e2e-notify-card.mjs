// Run against a production build: npm run build && npx next start -p 3100, then
//   node e2e/e2e-notify-card.mjs http://localhost:3100
// Uses the system Chrome (/usr/bin/google-chrome). Places one test order (an @example.com email, notes say
// it's safe to delete).
// After "Yes, all correct" on the invoice, the chat asks the customer to turn on notifications, right under the
// thanks, so the payment details reach them; not where the browser can't do notifications.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const OUT = "e2e/out"; // screenshots (git-ignored)
mkdirSync(OUT, { recursive: true });

const [base = "http://localhost:3100"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const report = [];
const check = (name, ok, detail = "") => report.push({ check: name, ok: Boolean(ok), detail: String(detail).slice(0, 240) });
const errors = [];
const stamp = Date.now().toString(36);
const UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";

async function step(name, run) {
  try {
    await run();
  } catch (error) {
    check(name, false, error.message.split("\n")[0]);
  }
}

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: UA, isMobile: true, hasTouch: true });
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
const chat = p.getByRole("dialog", { name: "Chat with us" });
const card = chat.getByText("Don't miss your payment details");

await step("an order opens the chat with the invoice question", async () => {
  await p.goto(base + "/product/banana-ice-iget-bar-3500-puffs", { waitUntil: "load" });
  for (let i = 0; i < 5; i++) {
    await p.getByRole("button", { name: "Add to cart" }).filter({ visible: true }).first().click();
    const added = await p.waitForFunction(() => (JSON.parse(localStorage.getItem("bvsa-cart") ?? "{}").state?.lines ?? []).length > 0, null, { timeout: 3000 }).catch(() => null);
    if (added) break;
  }
  await p.goto(base + "/checkout", { waitUntil: "load" });
  await p.waitForFunction(() => !document.querySelector("[aria-busy=true]"));
  await p.fill("#fullName", "Nina Notify");
  await p.fill("#email", `e2e.notify.${stamp}@example.com`);
  await p.fill("#phone", "0412345678");
  await p.fill("#addressLine1", "1 Test Street");
  await p.fill("#suburb", "Sydney");
  await p.selectOption("#state", "NSW");
  await p.fill("#postcode", "2000");
  await p.fill("#notes", "E2E notifications card test order, safe to delete");
  await p.getByRole("button", { name: /Place order/ }).click();
  await p.waitForURL("**/order/**", { timeout: 30000 });
  await chat.getByRole("button", { name: "Yes, all correct" }).waitFor({ timeout: 30000 });
  check("an order opens the chat with the invoice question", true);
  check("no card before the invoice is confirmed", (await card.count()) === 0);
});

await step("confirming shows the card under the thanks", async () => {
  await chat.getByRole("button", { name: "Yes, all correct" }).click();
  await card.waitFor({ timeout: 15000 });
  const order = await chat.evaluate((el) => {
    const text = el.textContent ?? "";
    return [text.indexOf("Thanks for confirming!"), text.indexOf("Don't miss your payment details")];
  });
  check("confirming shows the card under the thanks", order[0] >= 0 && order[1] > order[0], order.join(" "));
  check("the card has the Turn on notifications button", await chat.getByRole("button", { name: "Turn on notifications" }).isVisible());
  check("the banner at the top doesn't ask as well", (await chat.getByText("Get notified about replies, orders and new products").count()) === 0);
  await p.waitForTimeout(800);
  const inView = await chat.getByRole("button", { name: "Turn on notifications" }).evaluate((el) => {
    const box = el.getBoundingClientRect();
    const log = el.closest("[role=log]").getBoundingClientRect();
    return box.top >= log.top && box.bottom <= log.bottom;
  });
  check("the chat scrolls down to the card", inView);
  await p.screenshot({ path: `${OUT}/notify-card-phone.png` });
});

await step("turning notifications on", async () => {
  await ctx.grantPermissions(["notifications"], { origin: base });
  await chat.getByRole("button", { name: "Turn on notifications" }).click();
  // Headless Chrome may have no push service to subscribe to; when it does, the card says it's on.
  const on = await chat.getByText("Notifications on").waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  console.log("INFO subscribe in headless Chrome:", on ? "worked" : "no push service here");
  if (on) {
    check("turning notifications on ticks the card", true);
    await p.screenshot({ path: `${OUT}/notify-card-on.png` });
  }
});

await step("no card where the browser can't do notifications", async () => {
  await ctx.addInitScript(() => {
    delete window.PushManager;
  });
  await p.reload({ waitUntil: "load" });
  if (!(await chat.isVisible())) await p.getByRole("button", { name: /^Chat with us/ }).filter({ visible: true }).first().click();
  await chat.getByText("Thanks for confirming!").waitFor({ timeout: 20000 });
  await p.waitForTimeout(1500);
  check("no card where the browser can't do notifications", (await card.count()) === 0);
});

await browser.close();
check("no page errors or 5xx", errors.length === 0, errors.join(" | "));
for (const r of report) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.check}${r.ok ? "" : `  -> ${r.detail}`}`);
console.log(`\n${report.filter((r) => r.ok).length}/${report.length} passed`);
process.exitCode = report.every((r) => r.ok) ? 0 : 1;
