// Run against a production build: npm run build && npx next start -p 3100, then
//   node e2e/e2e-order-rules.mjs http://localhost:3100
// Uses the system Chrome (/usr/bin/google-chrome). Places no orders.
// Orders start at $100 of items (the cart, the checkout and the server all say so), and from $500 regular
// shipping is free and comes off express (Regular $20 -> free, Express $50 -> $30).
import { chromium } from "playwright";

const [base = "http://localhost:3100"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
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

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
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
const cart = p.getByRole("dialog");

/** A fresh cart holding one of this product, with the cart open. */
async function cartWith(slug) {
  await p.evaluate(() => localStorage.removeItem("bvsa-cart"));
  await p.goto(`${base}/product/${slug}`, { waitUntil: "load" });
  for (let i = 0; i < 5; i++) {
    await p.getByRole("button", { name: "Add to cart" }).filter({ visible: true }).first().click();
    const added = await p.waitForFunction(() => (JSON.parse(localStorage.getItem("bvsa-cart") ?? "{}").state?.lines ?? []).length > 0, null, { timeout: 3000 }).catch(() => null);
    if (added) break;
  }
  if (!(await cart.getByText("Subtotal").isVisible().catch(() => false))) await p.getByRole("button", { name: /^Open cart/ }).filter({ visible: true }).first().click();
  await cart.getByText("Subtotal").waitFor({ timeout: 10000 });
}
const deliveryPrices = async () => {
  await p.goto(base + "/checkout", { waitUntil: "load" });
  await p.waitForFunction(() => !document.querySelector("[aria-busy=true]") && document.querySelector('[role=radiogroup][aria-label=Shipping]'));
  await p.waitForTimeout(1500); // the quote
  return p.getByRole("radiogroup", { name: "Shipping" }).innerText();
};

await step("a $44 cart can't check out", async () => {
  await p.goto(base + "/", { waitUntil: "load" });
  await cartWith("banana-ice-iget-bar-3500-puffs");
  const says = await cart.getByText("Orders start at $100.00. Add $56.00 more to check out.").isVisible();
  const disabled = await cart.getByRole("button", { name: "Checkout" }).isDisabled();
  check("a $44 cart can't check out", says && disabled, `${says} ${disabled}`);
});

await step("the checkout won't place a $44 order", async () => {
  await deliveryPrices();
  const place = p.getByRole("button", { name: /Place order/ });
  check("the checkout says the minimum and holds the button", (await p.getByText("Add $56.00 more to check out.").isVisible()) && (await place.isDisabled()));
  // The server says no too, even when the button is forced.
  await p.fill("#fullName", "Rita Rules");
  await p.fill("#email", "e2e.rules@example.com");
  await p.fill("#phone", "0412345678");
  await p.fill("#addressLine1", "1 Test Street");
  await p.fill("#suburb", "Sydney");
  await p.selectOption("#state", "NSW");
  await p.fill("#postcode", "2000");
  await place.evaluate((b) => b.removeAttribute("disabled"));
  await place.click();
  const refused = await p.getByRole("alert").filter({ hasText: "Orders start at $100.00" }).waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
  check("the server refuses a $44 order", refused && !p.url().includes("/order/"), p.url());
});

await step("a $140 cart: full delivery prices, and how far to free shipping", async () => {
  await cartWith("iget-legend-vape");
  check("the cart says how far to free regular shipping", await cart.getByText("Add $360.00 more for free regular shipping.").isVisible());
  check("a $140 cart can check out", await cart.getByRole("link", { name: "Checkout" }).isVisible());
  const prices = await deliveryPrices();
  check("under $500 delivery costs its price", /\$20\.00/.test(prices) && /\$50\.00/.test(prices), prices.replace(/\s+/g, " "));
  check("the checkout says free regular shipping starts at $500", await p.getByText("Free regular shipping on orders from $500.00.").isVisible());
});

await step("a $560 cart: regular free, express $30", async () => {
  await p.goto(base + "/", { waitUntil: "load" });
  await cartWith("iget-legend-vape");
  for (let i = 0; i < 3; i++) await cart.getByRole("button", { name: "Increase quantity" }).first().click();
  await cart.getByText("$560.00").first().waitFor({ timeout: 5000 });
  check("the cart says free regular shipping", await cart.getByText("Free regular shipping on this order.").isVisible());
  const prices = await deliveryPrices();
  check("from $500 regular is free and express is $30", /Free/.test(prices) && /\$30\.00/.test(prices) && !/\$50\.00|\$20\.00/.test(prices), prices.replace(/\s+/g, " "));
  check("the checkout says the order gets free regular shipping", await p.getByText("Your order gets free regular shipping.").isVisible());
  const express = await p.getByRole("button", { name: /Place order/ }).innerText();
  check("express (the default) adds $30", express.includes("$590.00"), express);
  await p.getByRole("radiogroup", { name: "Shipping" }).getByText("Regular shipping").click();
  const regular = await p.getByRole("button", { name: /Place order/ }).innerText();
  check("regular adds nothing", regular.includes("$560.00"), regular);
});

await step("the shipping page shows the $500 prices and the minimum", async () => {
  await p.goto(base + "/shipping", { waitUntil: "load" });
  const text = await p.locator("main").innerText();
  check("the shipping page shows the $500 prices and the minimum", /Free on orders from \$500\.00/.test(text) && /\$30\.00 on orders from \$500\.00/.test(text) && /Orders start at \$100\.00/.test(text), text.replace(/\s+/g, " ").slice(0, 240));
});

await browser.close();
check("no page errors or 5xx", errors.length === 0, errors.join(" | "));
for (const r of report) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.check}${r.ok ? "" : `  -> ${r.detail}`}`);
console.log(`\n${report.filter((r) => r.ok).length}/${report.length} passed`);
process.exitCode = report.every((r) => r.ok) ? 0 : 1;
