// Run against a production build: npm run build && npx next start -p 3100, then
//   node e2e/e2e-checkout-fill.mjs http://localhost:3100
// Uses the system Chrome (/usr/bin/google-chrome). Test data uses @example.com emails; clear test sign-in
// limits between runs with: node --conditions=react-server --import tsx e2e/unlock.mts
// Checkout remembers a returning customer's details: from the last order placed on this device only.
import { chromium } from "playwright";

const [base = "http://localhost:3100"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const report = [];
const check = (name, ok, detail = "") => report.push({ check: name, ok: Boolean(ok), detail: String(detail).slice(0, 240) });
const errors = [];
const stamp = Date.now().toString(36);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const E = `e2e.fill.${stamp}@example.com`;

async function step(name, run) {
  try {
    await run();
  } catch (error) {
    check(name, false, error.message.split("\n")[0]);
  }
}
async function device() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("bvsa-age-confirmed", "yes");
      localStorage.setItem("bvsa-newsletter", JSON.stringify({ subscribed: true, shows: 0, lastClosedAt: null }));
      sessionStorage.setItem("bvsa-install-card", "hidden");
    } catch {}
  });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  p.on("response", (r) => r.status() >= 500 && r.status() !== 503 && errors.push(`${r.status()} ${r.url()}`));
  return { ctx, p };
}
async function addToCart(p) {
  await p.goto(base + "/product/banana-ice-iget-bar-3500-puffs", { waitUntil: "load" });
  for (let i = 0; i < 5; i++) {
    await p.getByRole("button", { name: "Add to cart" }).filter({ visible: true }).first().click();
    const added = await p.waitForFunction(() => (JSON.parse(localStorage.getItem("bvsa-cart") ?? "{}").state?.lines ?? []).length > 0, null, { timeout: 3000 }).catch(() => null);
    if (added) break;
  }
}
async function openCheckout(p) {
  await p.goto(base + "/checkout", { waitUntil: "load" });
  await p.waitForFunction(() => !document.querySelector("[aria-busy=true]"));
  await sleep(2500); // the saved details arrive a moment after the form
}
const fields = (p) =>
  p.evaluate(() => Object.fromEntries(["fullName", "email", "phone", "addressLine1", "addressLine2", "suburb", "state", "postcode", "notes"].map((id) => [id, document.getElementById(id)?.value ?? null])));

const { ctx: c1, p: p1 } = await device();
await step("first order", async () => {
  await addToCart(p1);
  await openCheckout(p1);
  const before = await fields(p1);
  check("a first-time checkout starts empty", !before.fullName && !before.email && !before.addressLine1, JSON.stringify(before));
  await p1.fill("#fullName", "Avery Fill");
  await p1.fill("#email", E);
  await p1.fill("#phone", "0412345678");
  await p1.fill("#addressLine1", "7 Remember Street");
  await p1.fill("#addressLine2", "Unit 2");
  await p1.fill("#suburb", "Sydney");
  await p1.selectOption("#state", "NSW");
  await p1.fill("#postcode", "2000");
  await p1.fill("#notes", "E2E checkout fill test, safe to delete");
  await p1.getByRole("button", { name: /Place order/ }).click();
  await p1.waitForURL("**/order/**", { timeout: 30000 });
});

await step("the next checkout on that device is filled in", async () => {
  await addToCart(p1);
  await openCheckout(p1);
  const v = await fields(p1);
  check(
    "the next checkout on that device is filled in",
    v.fullName === "Avery Fill" && v.email === E && v.phone === "0412 345 678" && v.addressLine1 === "7 Remember Street" && v.addressLine2 === "Unit 2" && v.suburb === "Sydney" && v.state === "NSW" && v.postcode === "2000" && v.notes === "",
    JSON.stringify(v)
  );
  const line = await p1.getByText("Filled in from your last order").isVisible().catch(() => false);
  check("it says where the details came from", line);
  await p1.getByRole("button", { name: "Clear" }).click();
  const cleared = await fields(p1);
  check("Clear empties the details", !cleared.fullName && !cleared.email && !cleared.addressLine1 && !cleared.phone, JSON.stringify(cleared));
});
await c1.close();

await step("another device that typed the email gets only the email", async () => {
  const { ctx, p } = await device();
  await p.goto(base + "/account", { waitUntil: "load" });
  await p.getByLabel("Email", { exact: true }).fill(E);
  await p.getByRole("button", { name: "Continue" }).click();
  await p.getByRole("button", { name: "Sign out on this device" }).waitFor({ timeout: 20000 });
  await addToCart(p);
  await openCheckout(p);
  const v = await fields(p);
  check("another device that typed the email gets only the email", v.email === E && !v.fullName && !v.phone && !v.addressLine1 && !v.suburb, JSON.stringify(v));
  check("no 'from your last order' line there", (await p.getByText("Filled in from your last order").count()) === 0);
  await ctx.close();
});

await browser.close();
check("no page errors or 5xx", errors.length === 0, errors.join(" | "));
for (const r of report) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.check}${r.ok ? "" : `  -> ${r.detail}`}`);
console.log(`\n${report.filter((r) => r.ok).length}/${report.length} passed`);
