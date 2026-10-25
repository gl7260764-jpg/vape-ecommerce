import "@/lib/test/env"; // must stay first: loads DATABASE_URL before the client is created
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, test } from "node:test";
import { prisma } from "@/lib/db";
import { alertCustomerMessage, alertNewOrder, alertNewSubscriber, getAlertTopic, ntfyTransport, saveAlertTopic, sendTestAlert, setAlertTransport } from "./alerts";

// Against the real database with the ntfy call replaced. The store has one topic, so it's put back after.
const stamp = randomUUID().slice(0, 8);
const SITE = process.env.SITE_URL ?? "https://bestvapeshopaustralia.com.au";
const NTFY = process.env.NTFY_URL ?? "https://ntfy.sh";
const topic = `test-${stamp}`;
const orderIds: string[] = [];

let sent: { url: string; body: Record<string, unknown> }[] = [];
let down = false;
setAlertTransport(async (url, body) => {
  if (down) throw new Error("ntfy is down");
  sent.push({ url, body: JSON.parse(body) });
});
let original: string | null = null;
before(async () => {
  original = await getAlertTopic();
  await saveAlertTopic(topic);
});
beforeEach(() => {
  sent = [];
  down = false;
});
after(async () => {
  await saveAlertTopic(original);
  await prisma.chatConversation.deleteMany({ where: { deviceTokenHash: { startsWith: `test-${stamp}` } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.$disconnect();
});

const item = (name: string, quantity: number) => ({ name, slug: `test-${stamp}`, unitPriceCents: 2200, quantity, lineTotalCents: 2200 * quantity });

test("a new order alert opens the order in the admin", async () => {
  const order = await prisma.order.create({
    data: {
      publicToken: `test-${stamp}-order`,
      paymentMethod: "payid",
      fullName: "Sarah Tester",
      email: `test.alerts.${stamp}@example.com`,
      phone: "+61412345678",
      addressLine1: "1 Test St",
      suburb: "Sydney",
      state: "NSW",
      postcode: "2000",
      shippingCode: "standard",
      shippingName: "Regular shipping",
      shippingCents: 2000,
      subtotalCents: 6600,
      totalCents: 8600,
      notes: "alerts test, safe to delete",
      items: { create: [item("Banana Ice", 2), item("Grape Ice", 1)] },
    },
  });
  orderIds.push(order.id);
  await alertNewOrder(order.id);
  assert.deepEqual(sent, [
    {
      url: NTFY,
      body: { topic, title: `New order BV-${order.number}`, message: "$86.00 from Sarah · 3 items", priority: 4, tags: ["package"], click: `${SITE}/admin/orders/${order.id}` },
    },
  ]);
});

test("a customer's message opens their chat", async () => {
  const conv = await prisma.chatConversation.create({ data: { deviceTokenHash: `test-${stamp}-a`, customerName: "Sarah Tester", customerEmail: `test.alerts.${stamp}@example.com` } });
  await alertCustomerMessage(conv.id, "Is the banana one in stock?");
  assert.deepEqual(
    sent.map((s) => s.body),
    [{ topic, title: "Message from Sarah Tester", message: "Is the banana one in stock?", priority: 4, tags: ["speech_balloon"], click: `${SITE}/admin/chats/${conv.id}` }]
  );
});

test("a chat opened with just an email shows the email, and a long message is cut short", async () => {
  const conv = await prisma.chatConversation.create({ data: { deviceTokenHash: `test-${stamp}-b`, customerName: "", customerEmail: `test.alerts.b.${stamp}@example.com` } });
  await alertCustomerMessage(conv.id, "x".repeat(500));
  assert.equal(sent[0].body.title, `Message from test.alerts.b.${stamp}@example.com`);
  assert.equal(sent[0].body.message, `${"x".repeat(199)}…`);
});

test("a new subscriber arrives quietly", async () => {
  await alertNewSubscriber("sarah@example.com");
  assert.deepEqual(
    sent.map((s) => s.body),
    [{ topic, title: "New subscriber", message: "sarah@example.com", priority: 2, tags: ["incoming_envelope"], click: `${SITE}/admin/subscribers` }]
  );
});

test("nothing is sent while no topic is set", async () => {
  await saveAlertTopic(null);
  await alertNewSubscriber("nobody@example.com").finally(() => saveAlertTopic(topic));
  assert.equal(sent.length, 0);
});

test("ntfy being down never breaks an order, a message or a sign-up", async () => {
  down = true;
  await alertNewSubscriber("sarah@example.com");
  await alertCustomerMessage(`missing-${stamp}`, "hi");
  await alertNewOrder(`missing-${stamp}`);
});

test("the test alert says whether ntfy took it", async () => {
  assert.equal(await sendTestAlert(topic), true);
  assert.equal(sent[0].body.title, "Phone alerts are on");
  assert.equal(sent[0].body.topic, topic);
  down = true;
  assert.equal(await sendTestAlert(topic), false);
});

test("ntfy that never answers is given up on", { timeout: 15_000 }, async () => {
  const silent = createServer(() => {}); // takes the request, never replies
  await new Promise<void>((resolve) => silent.listen(0, "127.0.0.1", resolve));
  const { port } = silent.address() as AddressInfo;
  try {
    await assert.rejects(ntfyTransport(`http://127.0.0.1:${port}`, "{}"));
  } finally {
    silent.closeAllConnections();
    silent.close();
  }
});
