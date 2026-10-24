import "@/lib/test/env"; // must stay first: loads DATABASE_URL before the client is created
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { prisma } from "@/lib/db";
import { accountForDevice, openAccount } from "./account";
import { actorForDevice } from "./chat/access";
import { openOrderConversation, sendMessage } from "./chat/service";

// Integration tests against the real database. Everything they create carries a test- prefix
// (devices) or a test.account.<stamp>@example.com email, and is removed after.
const stamp = randomUUID().slice(0, 8);
const dev = (name: string) => `test-${stamp}-${name}`;
const mail = (name: string) => `test.account.${stamp}.${name}@example.com`;
const orderIds: string[] = [];

async function makeOrder(email: string, n: number) {
  const o = await prisma.order.create({
    data: {
      publicToken: `test-${stamp}-${n}`,
      paymentMethod: "bank_transfer",
      fullName: "Account Tester",
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
      notes: "account test, safe to delete",
    },
  });
  orderIds.push(o.id);
  return o;
}

after(async () => {
  await prisma.chatConversation.deleteMany({ where: { deviceTokenHash: { startsWith: `test-${stamp}` } } });
  await prisma.orderAccess.deleteMany({ where: { tokenHash: { startsWith: `test-${stamp}` } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.customer.deleteMany({ where: { email: { startsWith: `test.account.${stamp}` } } });
  await prisma.$disconnect();
});

test("opening an account by email creates the customer and this device's chat", async () => {
  const email = mail("mia");
  const result = await openAccount(dev("mia"), `  ${email.toUpperCase()} `);
  assert.equal(result.isNew, true);
  assert.equal(result.email, email);
  const customer = await prisma.customer.findUniqueOrThrow({ where: { email } });
  assert.equal(customer.name, null);
  assert.equal(customer.phone, null);
  const conv = await prisma.chatConversation.findUniqueOrThrow({ where: { deviceTokenHash: dev("mia") } });
  assert.equal(conv.id, result.conversationId);
  assert.equal(conv.customerId, customer.id);
  assert.equal(conv.customerEmail, email);
  assert.equal(conv.customerName, email);
  const account = await accountForDevice(dev("mia"));
  assert.equal(account?.email, email);
  assert.equal(account?.conversationId, conv.id);
  assert.equal(account?.unread, 0);
});

test("an existing account opens without changing its details", async () => {
  const email = mail("ann");
  await prisma.customer.create({ data: { email, name: "Ann Test", phone: "+61400111222" } });
  await openAccount(dev("ann"), email);
  const customer = await prisma.customer.findUniqueOrThrow({ where: { email } });
  assert.equal(customer.name, "Ann Test");
  assert.equal(customer.phone, "+61400111222");
  const conv = await prisma.chatConversation.findUniqueOrThrow({ where: { deviceTokenHash: dev("ann") } });
  assert.equal(conv.customerName, "Ann Test");
});

test("a signed-in device stays in its account", async () => {
  const a = mail("first");
  const b = mail("second");
  const bOrder = await makeOrder(b, 1);
  await openAccount(dev("stay"), a);
  const second = await openAccount(dev("stay"), b);
  assert.equal(second.isNew, false);
  assert.equal(second.email, a);
  assert.ok(await prisma.customer.findUnique({ where: { email: b } }), "the second email still gets its account");
  const conv = await prisma.chatConversation.findUniqueOrThrow({ where: { deviceTokenHash: dev("stay") } });
  assert.equal(conv.customerEmail, a);
  assert.equal(await prisma.orderAccess.count({ where: { tokenHash: dev("stay"), orderId: bOrder.id } }), 0);
});

test("a new device gets a fresh chat and only order summaries", async () => {
  const email = mail("two-devices");
  const order = await makeOrder(email, 2);
  await prisma.orderAccess.create({ data: { tokenHash: dev("phone1"), orderId: order.id, fullDetails: true } });
  const first = await openOrderConversation(dev("phone1"), { ...order, customerId: null });
  assert.ok((await prisma.chatMessage.count({ where: { conversationId: first } })) > 0, "the ordering phone's chat has the invoice");

  const result = await openAccount(dev("phone2"), email);
  assert.notEqual(result.conversationId, first);
  assert.equal(await prisma.chatMessage.count({ where: { conversationId: result.conversationId } }), 0);
  const access = await prisma.orderAccess.findUniqueOrThrow({ where: { tokenHash_orderId: { tokenHash: dev("phone2"), orderId: order.id } } });
  assert.equal(access.fullDetails, false);
});

test("a device without orders can chat", async () => {
  const { conversationId } = await openAccount(dev("chatty"), mail("chatty"));
  const actor = await actorForDevice(dev("chatty"));
  assert.deepEqual(actor, { kind: "customer", conversationId });
  const sent = await sendMessage(actor!, { id: randomUUID(), conversationId, body: "hello" });
  assert.equal(sent.mine, true);
  assert.equal(await actorForDevice(dev("nobody")), null);
});

test("a device that just ordered is signed in before its chat is made", async () => {
  const email = mail("just-ordered");
  const order = await makeOrder(email, 3);
  await prisma.orderAccess.create({ data: { tokenHash: dev("just-ordered"), orderId: order.id, fullDetails: true } });
  // The checkout opens the chat a moment after replying; the account page can be faster.
  const account = await accountForDevice(dev("just-ordered"));
  assert.equal(account?.email, email);
  assert.ok(await prisma.chatMessage.count({ where: { conversationId: account!.conversationId, orderId: order.id } }), "its chat has the order");
});
