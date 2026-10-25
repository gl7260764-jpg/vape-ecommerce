import "@/lib/test/env"; // must stay first: loads DATABASE_URL before the client is created
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { type AddressInfo, createServer, type Socket } from "node:net";
import { after, beforeEach, test } from "node:test";
import { prisma } from "@/lib/db";
import { notifyChat, notifyOrder, pushConfigured, pushToAll, pushToDevices, savePushSubscription, setPushSender, webPushSender } from "./push";

// Against the real database with the network call replaced: test-<stamp> devices and endpoints.
const stamp = randomUUID().slice(0, 8);
const dev = (name: string) => `test-${stamp}-${name}`;
const endpoint = (name: string) => `https://push.example.com/${stamp}/${name}`;
const keys = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" };
const orderIds: string[] = [];

let sent: { endpoint: string; payload: { title: string; body: string; url: string } }[] = [];
const gone = new Set<string>();
setPushSender(async (subscription, payload) => {
  if (gone.has(subscription.endpoint)) return 410;
  sent.push({ endpoint: subscription.endpoint, payload: JSON.parse(payload) });
  return 201;
});
beforeEach(() => {
  sent = [];
});

const subscribe = (name: string, device: string) => savePushSubscription({ endpoint: endpoint(name), keys, tokenHash: dev(device), visitorId: null, platform: "Android" });

after(async () => {
  await prisma.pushSubscription.deleteMany({ where: { endpoint: { startsWith: `https://push.example.com/${stamp}/` } } });
  await prisma.chatConversation.deleteMany({ where: { deviceTokenHash: { startsWith: `test-${stamp}` } } });
  await prisma.orderAccess.deleteMany({ where: { tokenHash: { startsWith: `test-${stamp}` } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.$disconnect();
});

test("pushes go to the device's subscriptions and dead ones are removed", async () => {
  await subscribe("a1", "a");
  await subscribe("a2", "a");
  gone.add(endpoint("a2"));
  const count = await pushToDevices([dev("a")], { title: "Best Vape Shop", body: "hi", url: "/" });
  assert.equal(count, 1);
  assert.deepEqual(sent.map((s) => s.endpoint), [endpoint("a1")]);
  assert.equal(await prisma.pushSubscription.count({ where: { endpoint: endpoint("a2") } }), 0, "a 410 deletes the subscription");
  assert.equal(await pushToDevices([dev("nobody")], { title: "x", body: "y", url: "/" }), 0);
});

test("chat pushes skip online customers and wait a minute", async () => {
  await subscribe("b1", "b");
  const conv = await prisma.chatConversation.create({
    data: { deviceTokenHash: dev("b"), customerName: "Push Tester", customerEmail: `test.push.${stamp}@example.com`, lastMessagePreview: "Your order is on its way", customerLastSeenAt: new Date() },
  });
  await notifyChat(conv.id);
  assert.equal(sent.length, 0, "on the site right now: the message icon tells them");
  await prisma.chatConversation.update({ where: { id: conv.id }, data: { customerLastSeenAt: new Date(Date.now() - 5 * 60_000) } });
  await notifyChat(conv.id);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].payload, { title: "Best Vape Shop", body: "Your order is on its way", url: "/account?chat=1", tag: `chat-${conv.id}` });
  assert.ok((await prisma.chatConversation.findUniqueOrThrow({ where: { id: conv.id } })).lastPushAt);
  await notifyChat(conv.id);
  assert.equal(sent.length, 1, "at most one a minute");
});

test("order pushes go only to the device that placed it", async () => {
  const order = await prisma.order.create({
    data: {
      publicToken: `test-${stamp}-order`,
      paymentMethod: "payid",
      fullName: "Push Tester",
      email: `test.push.${stamp}@example.com`,
      phone: "+61412345678",
      addressLine1: "1 Test St",
      suburb: "Sydney",
      state: "NSW",
      postcode: "2000",
      shippingCode: "standard",
      shippingName: "Regular shipping",
      shippingCents: 2000,
      subtotalCents: 4400,
      totalCents: 6400,
      notes: "push test, safe to delete",
    },
  });
  orderIds.push(order.id);
  await prisma.orderAccess.createMany({ data: [{ tokenHash: dev("placed"), orderId: order.id, fullDetails: true }, { tokenHash: dev("typed"), orderId: order.id, fullDetails: false }] });
  await subscribe("c1", "placed");
  await subscribe("d1", "typed");
  await notifyOrder(order.id, "shipped");
  assert.deepEqual(sent.map((s) => s.endpoint), [endpoint("c1")]);
  assert.equal(sent[0].payload.body, `Order BV-${order.number} has shipped.`);
  assert.equal(sent[0].payload.url, `/order/${order.publicToken}`);
});

test("everyone gets it, even past a dead device at the end of a batch", async () => {
  for (const name of ["e1", "e2", "e3"]) await subscribe(name, "e");
  const ours = await prisma.pushSubscription.findMany({ where: { endpoint: { startsWith: `https://push.example.com/${stamp}/e` } }, orderBy: { id: "asc" }, select: { endpoint: true } });
  gone.add(ours[0].endpoint);
  await pushToAll({ title: "Just in", body: "x", url: "/" }, 1); // one at a time: every device ends a batch
  const reached = sent.map((s) => s.endpoint);
  assert.ok(reached.includes(ours[1].endpoint) && reached.includes(ours[2].endpoint), "the devices after the dead one still get it");
});

test("a push service that never answers is given up on", { skip: !pushConfigured && "needs the VAPID settings", timeout: 15_000 }, async () => {
  const sockets = new Set<Socket>();
  const silent = createServer((socket) => sockets.add(socket)); // takes the connection, never replies
  await new Promise<void>((resolve) => silent.listen(0, "127.0.0.1", resolve));
  const { port } = silent.address() as AddressInfo;
  try {
    await assert.rejects(webPushSender({ endpoint: `https://127.0.0.1:${port}/push`, keys }, "{}"), /timeout/i);
  } finally {
    for (const socket of sockets) socket.destroy();
    silent.close();
  }
});
