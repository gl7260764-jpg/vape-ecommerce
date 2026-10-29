// Run against a production build that sends alerts to this script's pretend ntfy:
//   npm run build && NTFY_URL=http://127.0.0.1:3998 npx next start -p 3100, then
//   E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… E2E_STAFF_EMAIL=… E2E_STAFF_PASSWORD=… node e2e/e2e-alerts.mjs http://localhost:3100
// (test owner and staff made with scripts/admin/create-admin.mts). Test data uses @example.com emails.
// Phone alerts (ntfy): the settings page, then an alert for a new subscriber, a customer message and a
// new order, none for the team's own replies. The store's topic is put back as it was at the end.
import { mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { chromium } from "playwright";

const OUT = "e2e/out"; // screenshots (git-ignored)
mkdirSync(OUT, { recursive: true });

const [base = "http://localhost:3100"] = process.argv.slice(2);
const OWNER = { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD };
const STAFF = { email: process.env.E2E_STAFF_EMAIL, password: process.env.E2E_STAFF_PASSWORD };
if (!OWNER.email || !OWNER.password || !STAFF.email || !STAFF.password) throw new Error("Set E2E_ADMIN_EMAIL/PASSWORD and E2E_STAFF_EMAIL/PASSWORD");
const report = [];
const check = (name, ok, detail = "") => report.push({ check: name, ok: Boolean(ok), detail: String(detail).slice(0, 240) });
const errors = [];
const stamp = Date.now().toString(36);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mail = (name) => `e2e.alerts.${name}.${stamp}@example.com`;

// The pretend ntfy: keeps every alert the store sends.
const alerts = [];
const ntfy = createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    try {
      alerts.push(JSON.parse(body));
    } catch {
      alerts.push({ raw: body });
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end("{}");
  });
});
await new Promise((resolve) => ntfy.listen(3998, "127.0.0.1", resolve));
async function alertWhere(match, ms = 20000) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(250)) {
    const found = alerts.find(match);
    if (found) return found;
  }
  return null;
}

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
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
async function signIn(who, path) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = watch(await ctx.newPage());
  await page.goto(base + `/admin/login?next=${encodeURIComponent(path)}`, { waitUntil: "load" });
  await page.fill("#email", who.email);
  await page.fill("#password", who.password);
  await page.click("button[type=submit]");
  await page.waitForURL(`**${path}`, { timeout: 60000 });
  return { ctx, page };
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
  return { ctx, p: watch(await ctx.newPage()) };
}
async function subscribe(p, email) {
  await p.goto(base + "/", { waitUntil: "load" });
  await p.fill("#newsletter-email", email);
  await p.locator("#newsletter-email").press("Enter");
  await p.getByText("You're in.").first().waitFor({ timeout: 20000 });
}

const { ctx: oc, page: op } = await signIn(OWNER, "/admin/settings/alerts");
const topicField = () => op.getByLabel("Topic", { exact: true });
let original = "";
let topic = "";
async function saveTopic(value) {
  await topicField().fill(value);
  await op.getByRole("button", { name: "Save", exact: true }).click();
}

await step("the settings page explains the setup", async () => {
  await topicField().waitFor({ timeout: 20000 });
  original = await topicField().inputValue();
  const text = await op.locator("body").innerText(); // visible text only (the sign-in page stays in the DOM, hidden)
  check("the settings page explains the setup", /ntfy/.test(text) && (await op.getByRole("button", { name: "Make a topic" }).count()) === 1, text.replace(/\s+/g, " ").slice(0, 200));
});

await step("a guessable topic is refused", async () => {
  await saveTopic("orders");
  const refused = await op.getByText(/at least 12/).first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  check("a guessable topic is refused", refused);
});

await step("Make a topic, save it and send a test", async () => {
  await op.getByRole("button", { name: "Make a topic" }).click();
  topic = await topicField().inputValue();
  check("Make a topic fills in a long random name", /^bvsa-[a-z0-9]{20,}$/.test(topic), topic);
  await op.getByRole("button", { name: "Save", exact: true }).click();
  await op.getByText("Phone alerts saved").first().waitFor({ timeout: 15000 });
  await op.getByRole("button", { name: "Send test" }).click();
  const test = await alertWhere((a) => a.title === "Phone alerts are on" && a.topic === topic);
  check("Send test reaches ntfy on that topic", test, JSON.stringify(test));
  await op.screenshot({ path: `${OUT}/alerts-settings.png` });
});

const { ctx: dc, p: dp } = await device();
const SUB = mail("sub");
await step("a new subscriber sends a quiet alert", async () => {
  await subscribe(dp, SUB);
  const a = await alertWhere((x) => x.title === "New subscriber" && x.message === SUB);
  check("a new subscriber sends a quiet alert", a && a.topic === topic && a.priority === 2 && a.click.endsWith("/admin/subscribers"), JSON.stringify(a));
  await subscribe(dp, SUB);
  await sleep(4000);
  check("subscribing again doesn't alert twice", alerts.filter((x) => x.message === SUB).length === 1, alerts.filter((x) => x.message === SUB).length);
});
await dc.close();

const { ctx: cc, p: cp } = await device();
const CHAT = mail("chat");
let conversationId = null;
const chatWindow = () => cp.getByRole("dialog", { name: "Chat with us" });
await step("a customer's first chat message sends an alert to that chat", async () => {
  await cp.goto(base + "/", { waitUntil: "load" });
  await cp.getByRole("button", { name: /^Chat with us/ }).filter({ visible: true }).first().click();
  const w = chatWindow();
  await w.getByLabel("Your email").fill(CHAT);
  await w.getByLabel("Message").fill(`Is Banana Ice in stock? ${stamp}`);
  await w.getByRole("button", { name: "Send" }).click();
  await w.getByText(`Chatting as ${CHAT}`).waitFor({ timeout: 20000 });
  conversationId = await cp.evaluate(async () => (await (await fetch("/api/chat/status", { cache: "no-store" })).json()).conversationId);
  const a = await alertWhere((x) => x.message === `Is Banana Ice in stock? ${stamp}`);
  check("a customer's first chat message sends an alert to that chat", a && a.title === `Message from ${CHAT}` && a.priority === 4 && a.click.endsWith(`/admin/chats/${conversationId}`), JSON.stringify(a));
});

await step("the next customer message alerts too", async () => {
  const w = chatWindow();
  await w.getByRole("textbox", { name: "Message" }).fill(`And Grape Ice? ${stamp}`);
  await w.getByRole("textbox", { name: "Message" }).press("Enter");
  const a = await alertWhere((x) => x.message === `And Grape Ice? ${stamp}`);
  check("the next customer message alerts too", a && a.click.endsWith(`/admin/chats/${conversationId}`), JSON.stringify(a));
});

await step("the team's reply doesn't alert", async () => {
  await op.goto(`${base}/admin/chats/${conversationId}`, { waitUntil: "load" });
  await op.getByRole("textbox", { name: "Message" }).fill(`Yes, both! ${stamp}`);
  await op.getByRole("button", { name: "Send" }).click();
  await op.getByText(`Yes, both! ${stamp}`).first().waitFor({ timeout: 20000 });
  await sleep(4000);
  check("the team's reply doesn't alert", !alerts.some((x) => String(x.message).includes(`Yes, both! ${stamp}`)));
});
await cc.close();

await step("a new order sends an alert to that order", async () => {
  const { ctx, p } = await device();
  await p.goto(base + "/product/iget-legend-vape", { waitUntil: "load" });
  for (let i = 0; i < 5; i++) {
    await p.getByRole("button", { name: "Add to cart" }).filter({ visible: true }).first().click();
    const added = await p.waitForFunction(() => (JSON.parse(localStorage.getItem("bvsa-cart") ?? "{}").state?.lines ?? []).length > 0, null, { timeout: 3000 }).catch(() => null);
    if (added) break;
  }
  await p.goto(base + "/checkout", { waitUntil: "load" });
  await p.waitForFunction(() => !document.querySelector("[aria-busy=true]"));
  await sleep(2500);
  await p.fill("#fullName", "Avery Alerts");
  await p.fill("#email", mail("order"));
  await p.fill("#phone", "0412345678");
  await p.fill("#addressLine1", "7 Alert Street");
  await p.fill("#suburb", "Sydney");
  await p.selectOption("#state", "NSW");
  await p.fill("#postcode", "2000");
  await p.fill("#notes", "E2E alerts test, safe to delete");
  await p.getByRole("button", { name: /Place order/ }).click();
  await p.waitForURL("**/order/**", { timeout: 30000 });
  const a = await alertWhere((x) => /^New order BV-\d+$/.test(x.title ?? "") && String(x.message).includes("from Avery"));
  check("a new order sends an alert to that order", a && a.priority === 4 && /\/admin\/orders\/[^/]+$/.test(a.click) && !String(a.message).includes("Alert Street"), JSON.stringify(a));
  await ctx.close();
});

await step("an empty topic turns the alerts off", async () => {
  await op.goto(base + "/admin/settings/alerts", { waitUntil: "load" });
  await topicField().waitFor({ timeout: 20000 });
  await saveTopic("");
  await op.getByText("Phone alerts turned off").first().waitFor({ timeout: 15000 });
  const { ctx, p } = await device();
  const OFF = mail("off");
  await subscribe(p, OFF);
  await sleep(4000);
  check("an empty topic turns the alerts off", !alerts.some((x) => x.message === OFF));
  await ctx.close();
});

await step("staff can't change phone alerts", async () => {
  const { ctx, page } = await signIn(STAFF, "/admin/orders");
  const inNav = await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Phone alerts" }).count();
  await page.goto(base + "/admin/settings/alerts", { waitUntil: "load" });
  await page.waitForURL((u) => !u.pathname.startsWith("/admin/settings/alerts"), { timeout: 15000 }).catch(() => {});
  check("staff can't change phone alerts", inNav === 0 && !new URL(page.url()).pathname.startsWith("/admin/settings/alerts"), `${page.url()} nav=${inNav}`);
  await ctx.close();
});

// Put the store's topic back as it was.
await step("the original topic is restored", async () => {
  await op.goto(base + "/admin/settings/alerts", { waitUntil: "load" });
  await topicField().waitFor({ timeout: 20000 });
  await saveTopic(original);
  await op.getByText(original ? "Phone alerts saved" : "Phone alerts turned off").first().waitFor({ timeout: 15000 });
});
await oc.close();

await browser.close();
ntfy.close();
check("no page errors or 5xx", errors.length === 0, errors.join(" | "));
for (const r of report) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.check}${r.ok ? "" : `  -> ${r.detail}`}`);
console.log(`\n${report.filter((r) => r.ok).length}/${report.length} passed`);
