// Run against a production build: npm run build && npx next start -p 3100, then
//   node e2e/e2e-live-chat.mjs http://localhost:3100
// Uses the system Chrome (/usr/bin/google-chrome). Test data uses @example.com emails; clear test sign-in
// limits between runs with: node --conditions=react-server --import tsx e2e/unlock.mts
// Live chat: the floating button for every visitor, the first message opening the account, the
// team's reply, coming back, phones, and the order chat still working.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const OUT = "e2e/out"; // screenshots (git-ignored)
mkdirSync(OUT, { recursive: true });

const [base = "http://localhost:3100"] = process.argv.slice(2);
// A test owner made with scripts/admin/create-admin.mts, passed in the environment (never stored here):
//   E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… node e2e/<suite>.mjs
const OWNER = { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD };
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const report = [];
const check = (name, ok, detail = "") => report.push({ check: name, ok: Boolean(ok), detail: String(detail).slice(0, 240) });
const errors = [];
const stamp = Date.now().toString(36);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mail = (name) => `e2e.live.${stamp}.${name}@example.com`;
const DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

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
// A visitor past the age check. card: false hides the install card for this visit; newsletter "later" keeps its pop-up away.
async function device({ viewport = { width: 1440, height: 900 }, card = false, newsletter = "later", mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport, userAgent: DESKTOP_UA, ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.addInitScript(({ card, newsletter }) => {
    try {
      localStorage.setItem("bvsa-age-confirmed", "yes");
      if (newsletter === "later") localStorage.setItem("bvsa-newsletter", JSON.stringify({ subscribed: false, shows: 0, lastClosedAt: Date.now() + 1e10 }));
      if (!card) sessionStorage.setItem("bvsa-install-card", "hidden");
    } catch {}
  }, { card, newsletter });
  return { ctx, p: watch(await ctx.newPage()) };
}
const chatButton = (p) => p.getByRole("button", { name: /^Chat with us/ }).filter({ visible: true }).first();
const chatWindow = (p) => p.getByRole("dialog", { name: "Chat with us" });
async function home(p) {
  await p.goto(base + "/", { waitUntil: "load" });
  await chatButton(p).waitFor({ timeout: 15000 });
}
const conversationOf = (p) => p.evaluate(async () => (await (await fetch("/api/chat/status", { cache: "no-store" })).json()).conversationId);
async function adminSession() {
  if (!OWNER.email || !OWNER.password) throw new Error("Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (a test owner from scripts/admin/create-admin.mts)");
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = watch(await ctx.newPage());
  await page.goto(base + "/admin/login?next=%2Fadmin%2Fchats", { waitUntil: "load" });
  await page.fill("#email", OWNER.email);
  await page.fill("#password", OWNER.password);
  await page.click("button[type=submit]");
  await page.waitForURL("**/admin/chats", { timeout: 60000 });
  return { ctx, page };
}

const E = mail("first");
const { ctx: c1, p: p1 } = await device();

await step("every visitor sees the chat button, pulsing", async () => {
  await home(p1);
  const pulses = await chatButton(p1).locator(".motion-safe\\:animate-ping, .animate-ping").count();
  check("every visitor sees the chat button, pulsing", pulses > 0, pulses);
});

await step("the first time asks for an email and a message", async () => {
  await chatButton(p1).click();
  const w = chatWindow(p1);
  await w.getByText("Start the conversation").waitFor({ timeout: 15000 }); // the form loads when the window opens
  const text = await w.innerText();
  check(
    "the first time asks for an email and a message",
    ["Best Vape Shop", "Start the conversation", "a real person will reply", "Sending opens your account with this email."].every((t) => text.includes(t)) &&
      (await w.getByLabel("Your email").count()) === 1 && (await w.getByLabel("Message").count()) === 1,
    text.replace(/\s+/g, " ")
  );
  await p1.screenshot({ path: `${OUT}/live-start-desktop.png` });
  await p1.keyboard.press("Escape");
  await w.waitFor({ state: "detached", timeout: 5000 });
});

await step("a bad email is refused", async () => {
  await chatButton(p1).click();
  const w = chatWindow(p1);
  await w.getByLabel("Your email").fill("not-an-email");
  await w.getByLabel("Message").fill("hello");
  await w.getByRole("button", { name: "Send" }).click();
  const refused = await w.getByText("Enter a valid email").waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  check("a bad email is refused", refused);
});

let conversationId = null;
await step("sending opens the account and the chat", async () => {
  const w = chatWindow(p1);
  await w.getByLabel("Your email").fill(E);
  await w.getByLabel("Message").fill(`Hi, do you have Banana Ice? ${stamp}`);
  await w.getByRole("button", { name: "Send" }).click();
  await w.getByText(`Chatting as ${E}`).waitFor({ timeout: 20000 });
  await w.getByText(`Hi, do you have Banana Ice? ${stamp}`).waitFor({ timeout: 20000 }); // then the conversation loads
  const text = await w.innerText();
  conversationId = await conversationOf(p1);
  const icon = await p1.getByRole("button", { name: /^Messages/ }).filter({ visible: true }).count();
  check("sending opens the account and the chat", text.includes(`Hi, do you have Banana Ice? ${stamp}`) && (await w.getByLabel("Your email").count()) === 0 && conversationId && icon > 0, text.replace(/\s+/g, " ").slice(0, 200));
  await p1.screenshot({ path: `${OUT}/live-chatting-desktop.png` });
});

await step("the team sees it and can reply", async () => {
  const { ctx, page: ap } = await adminSession();
  await ap.goto(`${base}/admin/chats/${conversationId}`, { waitUntil: "load" });
  const row = ap.locator(`a[href="/admin/chats/${conversationId}"]`);
  await row.waitFor({ timeout: 20000 });
  const rowText = await row.innerText();
  check("the team sees the new chat", rowText.includes(E) && rowText.includes("New account") && rowText.includes("Banana Ice"), rowText.replace(/\s+/g, " "));
  await ap.getByRole("textbox", { name: "Message" }).fill(`Yes, plenty! ${stamp}`);
  await ap.getByRole("button", { name: "Send" }).click();
  await ap.getByText(`Yes, plenty! ${stamp}`).first().waitFor({ timeout: 20000 });
  await ctx.close();
  const arrived = await chatWindow(p1).getByText(`Yes, plenty! ${stamp}`).waitFor({ timeout: 45000 }).then(() => true).catch(() => false);
  check("the customer sees the team's reply", arrived);
});

await step("coming back opens straight to the conversation", async () => {
  await home(p1);
  const pulses = await chatButton(p1).locator(".motion-safe\\:animate-ping, .animate-ping").count();
  check("the pulse stops after the first open", pulses === 0, pulses);
  await chatButton(p1).click();
  const w = chatWindow(p1);
  await w.getByText(`Hi, do you have Banana Ice? ${stamp}`).waitFor({ timeout: 20000 });
  check("coming back opens straight to the conversation", (await w.getByLabel("Your email").count()) === 0);
});
await c1.close();

await step("the trap field stops bots", async () => {
  const { ctx, p } = await device();
  await home(p);
  await chatButton(p).click();
  const w = chatWindow(p);
  await w.getByLabel("Your email").fill(mail("bot"));
  await w.getByLabel("Message").fill("buy cheap stuff");
  await p.evaluate(() => {
    const trap = document.querySelector('input[name="website"]');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    set.call(trap, "https://spam.example.com");
    trap.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await w.getByRole("button", { name: "Send" }).click();
  await sleep(3000);
  const status = await p.evaluate(async () => (await (await fetch("/api/chat/status", { cache: "no-store" })).json()).hasConversation);
  check("the trap field stops bots", status === false && (await w.getByLabel("Your email").count()) === 1, status);
  await ctx.close();
});

await step("on a phone the button clears the install card", async () => {
  const { ctx, p } = await device({ viewport: { width: 390, height: 844 }, card: true, mobile: true });
  await home(p);
  const card = p.getByRole("complementary", { name: "Get the app" });
  await card.waitFor({ timeout: 10000 });
  await sleep(700); // the button slides up when the card arrives
  const [b, c] = [await chatButton(p).boundingBox(), await card.boundingBox()];
  check("on a phone the button clears the install card", b && c && b.y + b.height <= c.y, `${JSON.stringify(b)} ${JSON.stringify(c)}`);
  await p.screenshot({ path: `${OUT}/live-button-phone.png` });
  await chatButton(p).click();
  const w = await chatWindow(p).boundingBox();
  check("on a phone the chat is full screen", w && w.width >= 388 && w.height >= 830, JSON.stringify(w));
  await p.screenshot({ path: `${OUT}/live-start-phone.png` });
  await ctx.close();
});

await step("no pop-up over the open chat", async () => {
  const { ctx, p } = await device({ newsletter: "fresh" });
  await home(p);
  await chatButton(p).click();
  await chatWindow(p).waitFor({ timeout: 10000 });
  await sleep(11000); // longer than the newsletter pop-up's first delay
  check("no pop-up over the open chat", (await p.getByRole("dialog", { name: "Get 10% off your next order" }).count()) === 0);
  await ctx.close();
});

await step("ordering still opens the chat with the invoice", async () => {
  const { ctx, p } = await device();
  await p.goto(base + "/product/iget-legend-vape", { waitUntil: "load" });
  for (let i = 0; i < 5; i++) {
    await p.getByRole("button", { name: "Add to cart" }).filter({ visible: true }).first().click();
    const added = await p.waitForFunction(() => (JSON.parse(localStorage.getItem("bvsa-cart") ?? "{}").state?.lines ?? []).length > 0, null, { timeout: 3000 }).catch(() => null);
    if (added) break;
  }
  await p.goto(base + "/checkout", { waitUntil: "load" });
  await p.waitForFunction(() => !document.querySelector("[aria-busy=true]"));
  await p.fill("#fullName", "Lee Live");
  await p.fill("#email", mail("order"));
  await p.fill("#phone", "0412345678");
  await p.fill("#addressLine1", "1 Test Street");
  await p.fill("#suburb", "Sydney");
  await p.selectOption("#state", "NSW");
  await p.fill("#postcode", "2000");
  await p.fill("#notes", "E2E live chat test order, safe to delete");
  await p.getByRole("button", { name: /Place order/ }).click();
  await p.waitForURL("**/order/**", { timeout: 30000 });
  const invoice = await chatWindow(p).getByRole("article").first().waitFor({ timeout: 30000 }).then(() => true).catch(() => false);
  check("ordering still opens the chat with the invoice", invoice && (await chatWindow(p).getByLabel("Your email").count()) === 0);
  await ctx.close();
});

await step("closing the chat puts focus back on its button", async () => {
  const { ctx, p } = await device();
  await home(p);
  await chatButton(p).click();
  await chatWindow(p).getByText("Start the conversation").waitFor({ timeout: 15000 });
  await p.keyboard.press("Escape");
  await chatWindow(p).waitFor({ state: "detached", timeout: 5000 });
  const focused = await p.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.tagName);
  check("closing the chat puts focus back on its button", /^Chat with us/.test(focused ?? ""), focused);
  await ctx.close();
});

await step("on a phone the chat window holds the focus", async () => {
  const { ctx, p } = await device({ viewport: { width: 390, height: 844 }, mobile: true });
  await home(p);
  await chatButton(p).click();
  await chatWindow(p).getByText("Start the conversation").waitFor({ timeout: 15000 });
  // Radix's modal dialog hides the rest of the page from screen readers (aria-hidden) and blocks clicks behind it.
  const hidden = await p.evaluate(() => Boolean(document.querySelector("header")?.closest('[aria-hidden="true"]')));
  check("on a phone the chat window holds the focus", hidden, hidden);
  await ctx.close();
});

await browser.close();
check("no page errors or 5xx", errors.length === 0, errors.join(" | "));
for (const r of report) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.check}${r.ok ? "" : `  -> ${r.detail}`}`);
console.log(`\n${report.filter((r) => r.ok).length}/${report.length} passed`);
