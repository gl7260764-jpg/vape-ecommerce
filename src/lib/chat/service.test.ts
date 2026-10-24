import "@/lib/test/env"; // must stay first: loads DATABASE_URL before the client is created
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { prisma } from "@/lib/db";
import type { Actor } from "./rules";
import { deleteMessage, editMessage, ensureOrderChats, listMessages, markReceipts, openOrderConversation, react, sendMessage, syncFrom } from "./service";

// Integration tests against the real database. Everything they create carries a test- prefix and is removed after.
const stamp = randomUUID().slice(0, 8);
let c: { id: string };
let other: { id: string };
let busy: { id: string };
let adminId: string;
let cust: Actor;
let staffActor: Actor;
let moderator: Actor;
const orderIds: string[] = [];
const ids = Array.from({ length: 6 }, () => randomUUID());

const convo = (id: string) => prisma.chatConversation.findUniqueOrThrow({ where: { id } });

async function makeOrder(n: number) {
  const o = await prisma.order.create({
    data: {
      publicToken: `test-${stamp}-${n}`,
      paymentMethod: "bank_transfer",
      fullName: "Chat Tester",
      email: `test.chat.${stamp}@example.com`,
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
      notes: "chat service test, safe to delete",
    },
  });
  orderIds.push(o.id);
  return o;
}

before(async () => {
  const admin = await prisma.adminUser.create({ data: { email: `test.chat.${stamp}@example.com`, name: "Chat Test Staff", passwordHash: "x", role: "staff" } });
  adminId = admin.id;
  c = await prisma.chatConversation.create({ data: { deviceTokenHash: `test-${stamp}-a`, customerName: "Chat Tester", customerEmail: `test.chat.${stamp}@example.com` } });
  other = await prisma.chatConversation.create({ data: { deviceTokenHash: `test-${stamp}-b`, customerName: "Other", customerEmail: "other@example.com" } });
  busy = await prisma.chatConversation.create({ data: { deviceTokenHash: `test-${stamp}-c`, customerName: "Busy", customerEmail: "busy@example.com" } });
  cust = { kind: "customer", conversationId: c.id };
  staffActor = { kind: "staff", adminId, canModerate: false };
  moderator = { kind: "staff", adminId, canModerate: true };
});

after(async () => {
  await prisma.chatConversation.deleteMany({ where: { deviceTokenHash: { startsWith: `test-${stamp}` } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.adminUser.deleteMany({ where: { id: adminId } });
  await prisma.$disconnect();
});

test("send is idempotent and bumps the other side's unread", async () => {
  const m1 = await sendMessage(cust, { id: ids[0], conversationId: c.id, body: "hi" });
  const m2 = await sendMessage(cust, { id: ids[0], conversationId: c.id, body: "hi" });
  assert.equal(m1.id, m2.id);
  assert.equal(m1.mine, true);
  const conv = await convo(c.id);
  assert.equal(conv.staffUnreadCount, 1);
  assert.equal(conv.lastMessagePreview, "hi");
});

test("customer cannot write to another conversation", async () => {
  await assert.rejects(sendMessage({ kind: "customer", conversationId: other.id }, { id: ids[1], conversationId: c.id, body: "x" }), { code: "FORBIDDEN" });
});

test("body over 4000 chars and empty messages are refused", async () => {
  await assert.rejects(sendMessage(cust, { id: randomUUID(), conversationId: c.id, body: "a".repeat(4001) }), { code: "TOO_LONG" });
  await assert.rejects(sendMessage(cust, { id: randomUUID(), conversationId: c.id, body: "   " }), { code: "EMPTY" });
});

test("edit works on an old message and marks it edited; staff can't edit the customer's", async () => {
  await prisma.chatMessage.update({ where: { id: ids[0] }, data: { createdAt: new Date(Date.now() - 30 * 86_400_000) } });
  const e = await editMessage(cust, { id: ids[0], body: "changed" });
  assert.equal(e.body, "changed");
  assert.equal(e.edited, true);
  await assert.rejects(editMessage(staffActor, { id: ids[0], body: "x" }), { code: "FORBIDDEN" });
});

test("staff replies show the staff name to staff only", async () => {
  await sendMessage(staffActor, { id: ids[2], conversationId: c.id, body: "hello from the store", replyToId: ids[0] });
  const asStaff = (await listMessages(c.id, staffActor, {})).find((m) => m.id === ids[2])!;
  const asCustomer = (await listMessages(c.id, cust, {})).find((m) => m.id === ids[2])!;
  assert.equal(asStaff.staffName, "Chat Test Staff");
  assert.equal(asStaff.mine, true);
  assert.equal(asCustomer.staffName, null);
  assert.equal(asCustomer.mine, false);
  assert.equal(asCustomer.replyTo?.id, ids[0]);
  assert.equal(asCustomer.replyTo?.preview, "changed");
});

test("delete keeps the row and hides content for both viewers", async () => {
  await sendMessage(cust, { id: ids[3], conversationId: c.id, body: "oops" });
  const d = await deleteMessage(cust, { id: ids[3] });
  assert.equal(d.deleted, true);
  assert.equal(d.deletedBySelf, true);
  assert.equal(d.body, "");
  assert.equal(d.attachment, null);
  const asStaff = (await listMessages(c.id, staffActor, {})).find((m) => m.id === ids[3])!;
  assert.equal(asStaff.deleted, true);
  assert.equal(asStaff.deletedBySelf, false);
  assert.equal(asStaff.body, "");
  assert.equal(await prisma.chatMessage.count({ where: { id: ids[3] } }), 1);
});

test("staff can't delete the customer's message but the owner (moderator) can", async () => {
  await sendMessage(cust, { id: ids[4], conversationId: c.id, body: "rude words" });
  await assert.rejects(deleteMessage(staffActor, { id: ids[4] }), { code: "FORBIDDEN" });
  const d = await deleteMessage(moderator, { id: ids[4] });
  assert.equal(d.deleted, true);
  const asCustomer = (await listMessages(c.id, cust, {})).find((m) => m.id === ids[4])!;
  assert.equal(asCustomer.deletedBySelf, false); // the customer sees "This message was deleted"
});

test("one reaction per side, replaced and removed", async () => {
  await react(cust, { id: ids[2], emoji: "👍" });
  await react(cust, { id: ids[2], emoji: "❤️" });
  await react(staffActor, { id: ids[0], emoji: "😂" });
  let m = (await listMessages(c.id, cust, {})).find((x) => x.id === ids[2])!;
  assert.deepEqual(m.reactions, [{ by: "customer", emoji: "❤️" }]);
  await react(cust, { id: ids[2], emoji: null });
  m = (await listMessages(c.id, cust, {})).find((x) => x.id === ids[2])!;
  assert.deepEqual(m.reactions, []);
  await assert.rejects(react(cust, { id: ids[2], emoji: "not an emoji" }), { code: "INVALID" });
});

test("read receipts mark the other side's messages and zero my unread", async () => {
  await markReceipts(staffActor, { conversationId: c.id, kind: "read", upTo: new Date().toISOString() });
  const rows = await prisma.chatMessage.findMany({ where: { conversationId: c.id, sender: "customer", deletedAt: null } });
  assert.ok(rows.length > 0 && rows.every((r) => r.readAt && r.deliveredAt));
  assert.equal((await convo(c.id)).staffUnreadCount, 0);
  const staffMsgs = await prisma.chatMessage.findMany({ where: { conversationId: c.id, sender: "staff" } });
  assert.ok(staffMsgs.every((r) => r.readAt === null)); // a reader never marks their own side
});

test("changedSince returns edits, deletes and receipts made after a point in time", async () => {
  const since = new Date(Date.now() - 1000).toISOString();
  await editMessage(cust, { id: ids[0], body: "changed again" });
  const changed = await listMessages(c.id, cust, { changedSince: since });
  assert.ok(changed.some((m) => m.id === ids[0] && m.body === "changed again"));
  assert.ok(!changed.some((m) => m.id === ids[4] && m.updatedAt < since));
});

test("31st customer message in a minute is rate limited", async () => {
  const busyActor: Actor = { kind: "customer", conversationId: busy.id };
  // Seed 30 messages from the last minute directly: sending them one by one over a slow link can take over a minute.
  await prisma.chatMessage.createMany({ data: Array.from({ length: 30 }, (_, i) => ({ id: randomUUID(), conversationId: busy.id, sender: "customer" as const, body: `m${i}` })) });
  await assert.rejects(sendMessage(busyActor, { id: randomUUID(), conversationId: busy.id, body: "one too many" }), { code: "RATE_LIMITED" });
});

test("order opens one conversation per device with order card and welcome", async () => {
  const o1 = await makeOrder(1);
  const o2 = await makeOrder(2);
  const device = `test-${stamp}-device`;
  const base = { customerId: null, fullName: "Chat Tester", email: `test.chat.${stamp}@example.com`, paymentMethod: "bank_transfer" };
  const id1 = await openOrderConversation(device, { ...base, id: o1.id, number: o1.number, totalCents: o1.totalCents });
  const id2 = await openOrderConversation(device, { ...base, id: o2.id, number: o2.number, totalCents: o2.totalCents });
  assert.equal(id1, id2);
  const msgs = await listMessages(id1, { kind: "customer", conversationId: id1 }, {});
  assert.deepEqual(msgs.slice(0, 2).map((m) => m.sender), ["system", "staff"]);
  assert.equal(msgs[0].order?.number, o1.number);
  assert.equal(msgs[0].order?.link, `/order/test-${stamp}-1`);
  // The invoice opens the chat, then the question (the spec replaced the old welcome).
  assert.equal(msgs[0].invoice?.number, `INV-${o1.number}`);
  assert.equal(msgs[1].body, "Please check your invoice. Are your items, delivery address and contact details all correct?");
  assert.equal((await convo(id1)).customerUnreadCount, 2); // one welcome per order
  // Each new order is waiting on the team: it lights up the badge, and the inbox says what came in.
  assert.equal((await convo(id1)).staffUnreadCount, 2);
  assert.equal((await convo(id1)).lastMessagePreview, `New order BV-${o2.number}`);
  await markReceipts(staffActor, { conversationId: id1, kind: "read", upTo: new Date().toISOString() });
  assert.equal((await convo(id1)).staffUnreadCount, 0);
});

test("attachment keys must be files uploaded into this conversation", async () => {
  const attach = (key: string) =>
    sendMessage(cust, { id: randomUUID(), conversationId: c.id, body: "", attachment: { key, name: "x.webp", mime: "image/webp", size: 10, width: 1, height: 1 } });
  await assert.rejects(attach(`chat/${c.id}/../../chat/${other.id}/abcdef123456-x.webp`), { code: "FORBIDDEN" });
  await assert.rejects(attach(`chat/${c.id}/not-from-an-upload.webp`), { code: "FORBIDDEN" });
});

test("opening the same order twice adds its card once", async () => {
  const o = await makeOrder(3);
  const device = `test-${stamp}-twice`;
  const input = { customerId: null, fullName: "Chat Tester", email: `test.chat.${stamp}@example.com`, paymentMethod: "bank_transfer", id: o.id, number: o.number, totalCents: o.totalCents };
  const [a, b] = await Promise.all([openOrderConversation(device, input), openOrderConversation(device, input)]);
  assert.equal(a, b);
  assert.equal(await prisma.chatMessage.count({ where: { orderId: o.id } }), 1);
  assert.equal((await convo(a)).customerUnreadCount, 1);
  assert.equal((await convo(a)).staffUnreadCount, 1);
});

test("a device whose order hook failed gets its chat on the next check; email lookups never do", async () => {
  const o = await makeOrder(4);
  const device = `test-${stamp}-recover`;
  const lookup = `test-${stamp}-lookup`;
  await prisma.orderAccess.createMany({ data: [{ tokenHash: device, orderId: o.id, fullDetails: true }, { tokenHash: lookup, orderId: o.id, fullDetails: false }] });
  await ensureOrderChats(lookup);
  assert.equal(await prisma.chatConversation.count({ where: { deviceTokenHash: lookup } }), 0);
  await ensureOrderChats(device);
  await ensureOrderChats(device);
  const conv = await prisma.chatConversation.findUnique({ where: { deviceTokenHash: device } });
  assert.ok(conv, "the missing conversation is created");
  assert.equal(await prisma.chatMessage.count({ where: { conversationId: conv.id, orderId: o.id } }), 1);
});

test("a sync reaches back 10 seconds and refuses a malformed time", () => {
  assert.equal(syncFrom("2026-10-23T10:00:10.000Z"), "2026-10-23T10:00:00.000Z");
  assert.throws(() => syncFrom("yesterday"), { code: "INVALID" });
});
