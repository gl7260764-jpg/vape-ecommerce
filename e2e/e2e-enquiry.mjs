// Run against a production build that sends to this script's pretend ntfy and Brevo:
//   npm run build && NTFY_URL=http://127.0.0.1:3998 BREVO_API_URL=http://127.0.0.1:3997 BREVO_API_KEY=e2e-key npx next start -p 3100
//   E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… E2E_STAFF_EMAIL=… E2E_STAFF_PASSWORD=… node e2e/e2e-enquiry.mjs http://localhost:3100
// (test owner and staff made with scripts/admin/create-admin.mts). Test data uses @example.com emails.
// The contact page's enquiry form: sent, a phone alert and an email, listed in Admin › Enquiries, marked done.
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

// Pretend ntfy and Brevo: keep everything the store sends.
const received = { alerts: [], emails: [] };
function pretend(port, list) {
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        list.push({ apiKey: req.headers["api-key"], ...JSON.parse(body) });
      } catch {
        list.push({ raw: body });
      }
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end('{"messageId":"<e2e>"}');
    });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}
const ntfy = await pretend(3998, received.alerts);
const brevo = await pretend(3997, received.emails);
async function waitFor(list, match, ms = 20000) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(250)) {
    const found = list.find(match);
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
async function visitor() {
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

const NAME = `E2E Enquirer ${stamp}`;
const EMAIL = `e2e.enquiry.${stamp}@example.com`;
const MESSAGE = `Do you ship Grape Ice to Perth? ${stamp}`;
const { ctx: vc, p: vp } = await visitor();
const form = () => vp.locator("form").filter({ has: vp.getByRole("button", { name: "Send message" }) });

await step("the contact page has the message box", async () => {
  await vp.goto(base + "/contact", { waitUntil: "load" });
  await form().waitFor({ timeout: 20000 });
  const labels = await Promise.all(["Name", "Email", "Phone (optional)", "Message"].map((l) => form().getByLabel(l, { exact: true }).count()));
  check("the contact page has the message box", labels.every((n) => n === 1), labels.join(","));
});

await step("an empty message is refused", async () => {
  await form().getByRole("button", { name: "Send message" }).click();
  const refused = await form().getByText("Enter your name").waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  check("an empty message is refused", refused);
});

await step("sending thanks the customer", async () => {
  await form().getByLabel("Name", { exact: true }).fill(NAME);
  await form().getByLabel("Email", { exact: true }).fill(EMAIL);
  await form().getByLabel("Phone (optional)", { exact: true }).fill("0412 345 678");
  await form().getByLabel("Message", { exact: true }).fill(MESSAGE);
  await form().getByRole("button", { name: "Send message" }).click();
  const thanked = await vp.getByText("Thanks, E2E. We've got your message").waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
  check("sending thanks the customer", thanked);
  await vp.screenshot({ path: `${OUT}/enquiry-sent.png` });
});

await step("the team gets a phone alert and an email", async () => {
  const alert = await waitFor(received.alerts, (a) => a.title === `New enquiry from ${NAME}`);
  check("the team gets a phone alert", alert && alert.message === MESSAGE && String(alert.click).endsWith("/admin/enquiries"), JSON.stringify(alert));
  const email = await waitFor(received.emails, (e) => e.subject === `New enquiry from ${NAME}`);
  check(
    "the team gets an email they can reply to",
    email && email.apiKey === "e2e-key" && email.replyTo?.email === EMAIL && String(email.textContent).includes(MESSAGE) && String(email.textContent).includes("0412 345 678"),
    JSON.stringify(email)
  );
});
await vc.close();

await step("the trap field stops bots", async () => {
  const { ctx, p } = await visitor();
  await p.goto(base + "/contact", { waitUntil: "load" });
  const f = p.locator("form").filter({ has: p.getByRole("button", { name: "Send message" }) });
  await f.waitFor({ timeout: 20000 });
  await f.getByLabel("Name", { exact: true }).fill(`Bot ${stamp}`);
  await f.getByLabel("Email", { exact: true }).fill(`e2e.bot.${stamp}@example.com`);
  await f.getByLabel("Message", { exact: true }).fill("cheap stuff");
  await p.evaluate(() => {
    // Typed the way a browser does, so the form sees it (as a bot filling every field would).
    const trap = document.querySelector('input[name="website"]');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    set.call(trap, "http://spam.example.com");
    trap.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await f.getByRole("button", { name: "Send message" }).click();
  await sleep(4000);
  check("the trap field stops bots", !received.alerts.some((a) => a.title === `New enquiry from Bot ${stamp}`));
  await ctx.close();
});

await step("Admin › Enquiries lists it with reply and call links", async () => {
  const { ctx, page } = await signIn(OWNER, "/admin/enquiries");
  const item = page.getByRole("region", { name: "New enquiries" }).getByRole("listitem").filter({ hasText: NAME });
  await item.waitFor({ timeout: 20000 }); // the page streams in after the URL changes
  const inNav = await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Enquiries" }).count();
  const text = await item.innerText();
  const mail = await item.locator(`a[href^="mailto:${EMAIL}"]`).count();
  const tel = await item.locator('a[href^="tel:"]').count();
  check("Admin › Enquiries lists it with reply and call links", inNav === 1 && text.includes(MESSAGE) && mail === 1 && tel === 1, text.replace(/\s+/g, " "));
  await page.screenshot({ path: `${OUT}/enquiry-admin.png` });
  await item.getByRole("button", { name: "Mark as done" }).click();
  const done = page.getByRole("region", { name: "Done" }).getByRole("listitem").filter({ hasText: NAME });
  const moved = await done.waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
  check("marking it done moves it to Done", moved && (await item.count()) === 0);
  await ctx.close();
});

await step("staff can read enquiries too", async () => {
  const { ctx, page } = await signIn(STAFF, "/admin/enquiries");
  const shown = await page.getByRole("heading", { name: "Enquiries" }).waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
  check("staff can read enquiries too", shown && new URL(page.url()).pathname === "/admin/enquiries", page.url());
  await ctx.close();
});

await browser.close();
ntfy.close();
brevo.close();
check("no page errors or 5xx", errors.length === 0, errors.join(" | "));
for (const r of report) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.check}${r.ok ? "" : `  -> ${r.detail}`}`);
console.log(`\n${report.filter((r) => r.ok).length}/${report.length} passed`);
