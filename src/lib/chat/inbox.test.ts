import "@/lib/test/env"; // must stay first: loads DATABASE_URL before the client is created
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { prisma } from "@/lib/db";
import { conversationContext, listInbox } from "./inbox";
import { markAllDelivered, openOrderConversation, sendMessage } from "./service";

// Integration tests for the admin's side: the inbox, its search, the context panel and inbox delivery.
const stamp = randomUUID().slice(0, 8);
const email = `test.inbox.${stamp}@example.com`;
const orderIds: string[] = [];
let quiet: string;
let chatty: string;
let order: { id: string; number: number; totalCents: number };
let visitorId: string;

async function makeOrder(n: number, extra: { visitorId?: string } = {}) {
  const o = await prisma.order.create({
    data: {
      publicToken: `test-${stamp}-${n}`,
      paymentMethod: "payid",
      fullName: `Inbox Tester ${stamp}`,
      email,
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
      notes: "chat inbox test, safe to delete",
      ...extra,
    },
  });
  orderIds.push(o.id);
  return o;
}

before(async () => {
  visitorId = (await prisma.visitor.create({ data: { id: `test-${stamp}-visitor` }, select: { id: true } })).id;
  order = await makeOrder(1, { visitorId });
  await makeOrder(2); // same email, placed on another device: still listed in the context
  const base = { customerId: null, fullName: `Inbox Tester ${stamp}`, email, paymentMethod: "payid" };
  chatty = await openOrderConversation(`test-${stamp}-chatty`, { ...base, id: order.id, number: order.number, totalCents: order.totalCents });
  quiet = (
    await prisma.chatConversation.create({
      data: { deviceTokenHash: `test-${stamp}-quiet`, customerName: `Quiet ${stamp}`, customerEmail: `quiet.${stamp}@example.com`, lastMessageAt: new Date(Date.now() - 86_400_000) },
    })
  ).id;
  await sendMessage({ kind: "customer", conversationId: chatty }, { id: randomUUID(), conversationId: chatty, body: "is payid ok?" });
});

after(async () => {
  await prisma.chatConversation.deleteMany({ where: { deviceTokenHash: { startsWith: `test-${stamp}` } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.visitor.deleteMany({ where: { id: visitorId } });
  await prisma.$disconnect();
});

test("inbox lists the most recent first, with unread counts and the last message", async () => {
  const { conversations, unreadTotal } = await listInbox({ q: stamp });
  assert.deepEqual(
    conversations.map((c) => c.id),
    [chatty, quiet]
  );
  assert.equal(conversations[0].staffUnreadCount, 2); // the new order, then the question
  assert.equal(conversations[0].lastMessagePreview, "is payid ok?");
  assert.ok(unreadTotal >= 1, "the badge total counts every conversation");
});

test("inbox search matches the name, the email and the order number", async () => {
  const ids = async (q: string) => (await listInbox({ q })).conversations.map((c) => c.id);
  assert.deepEqual(await ids(`Inbox Tester ${stamp}`), [chatty]);
  assert.deepEqual(await ids(`QUIET.${stamp}@example.com`), [quiet]);
  assert.deepEqual(await ids(`BV-${order.number}`), [chatty]);
  assert.deepEqual(await ids(String(order.number)), [chatty]);
});

test("the unread filter keeps conversations waiting on the team", async () => {
  const ids = (await listInbox({ q: stamp, unread: true })).conversations.map((c) => c.id);
  assert.deepEqual(ids, [chatty]);
});

test("the inbox marks customer messages delivered, never read", async () => {
  await markAllDelivered();
  const rows = await prisma.chatMessage.findMany({ where: { conversationId: chatty }, select: { sender: true, deliveredAt: true, readAt: true } });
  const customer = rows.filter((r) => r.sender === "customer");
  assert.ok(customer.length > 0 && customer.every((r) => r.deliveredAt && !r.readAt));
  assert.ok(rows.filter((r) => r.sender === "staff").every((r) => !r.readAt), "the store's own messages are left alone");
});

test("the context lists every order for the email and the visitor who ordered", async () => {
  const context = await conversationContext(chatty);
  assert.equal(context?.orders.length, 2);
  assert.ok(context?.orders.every((o) => typeof o.number === "number" && typeof o.createdAt === "string"));
  assert.equal(context?.visitorId, visitorId);
  assert.equal(context?.phone, "+61412345678");
  assert.equal(await conversationContext("cnotarealconversation00"), null);
});

test("a chat from a device without an order is tagged", async () => {
  const subEmail = `sub.${stamp}@example.com`;
  await prisma.subscriber.create({ data: { email: subEmail, source: "popup" } });
  const sub = await prisma.chatConversation.create({
    data: { deviceTokenHash: `test-${stamp}-sub`, customerName: subEmail, customerEmail: subEmail, lastMessageAt: new Date(Date.now() - 2 * 86_400_000) },
  });
  try {
    const tags = Object.fromEntries((await listInbox({ q: stamp })).conversations.map((c) => [c.id, c.tag]));
    assert.equal(tags[chatty], null, "a device that ordered is not tagged");
    assert.equal(tags[quiet], "New account");
    assert.equal(tags[sub.id], "Subscriber");
  } finally {
    await prisma.subscriber.deleteMany({ where: { email: subEmail } });
  }
});
