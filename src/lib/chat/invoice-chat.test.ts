import "@/lib/test/env"; // must stay first: loads DATABASE_URL before the client is created
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { INVOICE_COPY } from "@/lib/invoices/rules";
import { createInvoice } from "@/lib/invoices/service";
import type { Actor } from "./rules";
import { answerInvoice, chatMessageIdFor, issueInvoice, listMessages, openOrderConversation, postInvoice, refreshInvoiceMessages } from "./service";

// Invoices in the chat, against the real database. Everything created carries a test- prefix and is removed after.
const stamp = randomUUID().slice(0, 8);
const orderIds: string[] = [];

const orderData = (n: number | string) =>
  ({
    publicToken: `test-${stamp}-${n}`,
    paymentMethod: "payid",
    fullName: "Invoice Chat Tester",
    email: `test.invchat.${stamp}@example.com`,
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
    notes: "invoice chat test, safe to delete",
    items: { create: [{ name: "Test Bar", slug: "test-bar", unitPriceCents: 4400, quantity: 1, lineTotalCents: 4400 }] },
  }) satisfies Prisma.OrderCreateInput;

async function orderWithChat(n: number) {
  const o = await prisma.order.create({ data: orderData(n) });
  orderIds.push(o.id);
  const device = `test-${stamp}-device-${n}`;
  await prisma.orderAccess.create({ data: { tokenHash: device, orderId: o.id, fullDetails: true } });
  const conversationId = await openOrderConversation(device, {
    id: o.id,
    number: o.number,
    totalCents: o.totalCents,
    paymentMethod: o.paymentMethod,
    customerId: null,
    fullName: o.fullName,
    email: o.email,
  });
  const customer: Actor = { kind: "customer", conversationId };
  return { order: o, conversationId, customer };
}

const invoiceOf = (orderId: string, version = 1) => prisma.invoice.findUniqueOrThrow({ where: { orderId_version: { orderId, version } } });
const convo = (id: string) => prisma.chatConversation.findUniqueOrThrow({ where: { id } });

after(async () => {
  await prisma.chatConversation.deleteMany({ where: { deviceTokenHash: { startsWith: `test-${stamp}` } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.$disconnect();
});

test("a new order opens the chat with invoice v1 and the question", async () => {
  const { order, conversationId, customer } = await orderWithChat(1);
  const msgs = await listMessages(conversationId, customer, {});
  assert.equal(msgs[0].sender, "system");
  assert.equal(msgs[0].invoice?.number, `INV-${order.number}`);
  assert.equal(msgs[0].invoice?.status, "payment_due");
  assert.equal(msgs[0].invoice?.link, `/invoice/${order.publicToken}?v=1`);
  assert.equal(msgs[0].invoice?.snapshot.totalCents, 6400);
  assert.equal(msgs[1].sender, "staff");
  assert.equal(msgs[1].body, INVOICE_COPY.question);
  assert.equal(msgs[1].invoice?.askConfirm, true);
  assert.equal(msgs[1].invoice?.latest, true);
  assert.equal(msgs[1].invoice?.answer, null);
  assert.ok(!msgs.some((m) => m.body.startsWith("Thanks! We'll send")), "the old welcome is gone");
  const staffView = await listMessages(conversationId, { kind: "staff", adminId: "nobody", canModerate: false }, {});
  assert.equal(staffView[0].invoice?.link, `/admin/invoice/${order.id}/1`);
});

test("answers once, and never on a replaced invoice", async () => {
  const { order, customer } = await orderWithChat(2);
  const v1 = await invoiceOf(order.id);
  const [a, b] = await Promise.all([
    answerInvoice(customer, { invoiceId: v1.id, answer: "confirmed" }),
    answerInvoice(customer, { invoiceId: v1.id, answer: "confirmed" }),
  ]);
  assert.equal(a.length + b.length, 2, "one answer and one reply between the two taps");
  assert.equal(await prisma.chatMessage.count({ where: { conversationId: customer.conversationId, sender: "customer", body: INVOICE_COPY.yesMessage } }), 1);

  const v2 = await createInvoice(order.id, { sentById: null });
  assert.deepEqual(await postInvoice(v2.id), { posted: true });
  await assert.rejects(answerInvoice(customer, { invoiceId: v1.id, answer: "disputed" }), { code: "FORBIDDEN" });
  const stranger: Actor = { kind: "customer", conversationId: (await orderWithChat(3)).conversationId };
  await assert.rejects(answerInvoice(stranger, { invoiceId: v2.id, answer: "confirmed" }), { code: "FORBIDDEN" });
});

test("confirming adds the reply and alerts the team; something's wrong asks what to change", async () => {
  const yes = await orderWithChat(4);
  const before = (await convo(yes.conversationId)).staffUnreadCount;
  const added = await answerInvoice(yes.customer, { invoiceId: (await invoiceOf(yes.order.id)).id, answer: "confirmed" });
  assert.deepEqual(
    added.map((m) => [m.sender, m.body]),
    [
      ["customer", INVOICE_COPY.yesMessage],
      ["staff", INVOICE_COPY.yesReply],
    ]
  );
  const after = await convo(yes.conversationId);
  assert.equal(after.staffUnreadCount, before + 1);
  assert.equal(after.lastMessagePreview, "Invoice confirmed");
  assert.equal((await invoiceOf(yes.order.id)).answer, "confirmed");

  const no = await orderWithChat(5);
  const reply = await answerInvoice(no.customer, { invoiceId: (await invoiceOf(no.order.id)).id, answer: "disputed" });
  assert.deepEqual(
    reply.map((m) => m.body),
    [INVOICE_COPY.noMessage, INVOICE_COPY.noReply]
  );
  assert.equal((await convo(no.conversationId)).lastMessagePreview, "Invoice: something's wrong");
});

test("a paid order's new invoice has no question; an order without a chat isn't posted", async () => {
  const { order, conversationId, customer } = await orderWithChat(6);
  await prisma.order.update({ where: { id: order.id }, data: { status: "paid" } });
  const v2 = await createInvoice(order.id, { sentById: null });
  await postInvoice(v2.id);
  const msgs = await listMessages(conversationId, customer, {});
  const last = msgs.at(-1)!;
  assert.equal(last.sender, "system");
  assert.equal(last.invoice?.number, `INV-${order.number}-2`);
  assert.equal(last.invoice?.status, "paid");
  assert.equal(msgs.filter((m) => m.invoice?.version === 2).length, 1, "no question after a paid order's invoice");

  const lonely = await prisma.order.create({ data: orderData("lonely") });
  orderIds.push(lonely.id);
  const v1 = await createInvoice(lonely.id, { sentById: null });
  assert.deepEqual(await postInvoice(v1.id), { posted: false });
});

test("new invoice and status change reach a changedSince sync", async () => {
  const { order, conversationId, customer } = await orderWithChat(7);
  const since = new Date().toISOString();
  await new Promise((r) => setTimeout(r, 20));
  const v2 = await createInvoice(order.id, { sentById: null });
  await postInvoice(v2.id);
  const changed = await listMessages(conversationId, customer, { changedSince: since });
  const oldCard = changed.find((m) => m.sender === "system" && m.invoice?.version === 1);
  assert.equal(oldCard?.invoice?.status, "replaced");
  assert.equal(changed.find((m) => m.sender === "staff" && m.invoice?.version === 1)?.invoice?.latest, false);

  const since2 = new Date().toISOString();
  await new Promise((r) => setTimeout(r, 20));
  await prisma.order.update({ where: { id: order.id }, data: { status: "paid" } });
  await refreshInvoiceMessages(order.id);
  const afterPaid = await listMessages(conversationId, customer, { changedSince: since2 });
  assert.equal(afterPaid.find((m) => m.sender === "system" && m.invoice?.version === 2)?.invoice?.status, "paid");
});

test("after payment the question can't be answered, and a later chat doesn't ask it", async () => {
  const { order, customer } = await orderWithChat(8);
  const v1 = await invoiceOf(order.id);
  await prisma.order.update({ where: { id: order.id }, data: { status: "paid" } });
  await assert.rejects(answerInvoice(customer, { invoiceId: v1.id, answer: "confirmed" }), { code: "FORBIDDEN" });
  assert.equal((await invoiceOf(order.id)).answer, null);

  // An order invoiced before it had a chat, then paid: the chat opens with the invoice and no question.
  const late = await prisma.order.create({ data: orderData("late") });
  orderIds.push(late.id);
  await createInvoice(late.id, { sentById: null });
  await prisma.order.update({ where: { id: late.id }, data: { status: "paid" } });
  const device = `test-${stamp}-device-late`;
  await prisma.orderAccess.create({ data: { tokenHash: device, orderId: late.id, fullDetails: true } });
  const conv = await openOrderConversation(device, { id: late.id, number: late.number, totalCents: late.totalCents, paymentMethod: late.paymentMethod, customerId: null, fullName: late.fullName, email: late.email });
  const msgs = await listMessages(conv, { kind: "customer", conversationId: conv }, {});
  assert.deepEqual(msgs.map((m) => m.sender), ["system"], "the invoice only");
});

test("sending an invoice is all or nothing", async () => {
  const { order, conversationId } = await orderWithChat(9);
  // Something already holds the id the version-2 invoice message will use: the post fails part-way.
  await prisma.chatMessage.create({ data: { id: chatMessageIdFor(`${order.id}:v2`, "card"), conversationId, sender: "staff", body: "in the way" } });
  await assert.rejects(issueInvoice(order.id, null));
  assert.equal(await prisma.invoice.count({ where: { orderId: order.id, version: 2 } }), 0, "no phantom INV-…-2");
  await prisma.chatMessage.delete({ where: { id: chatMessageIdFor(`${order.id}:v2`, "card") } });
  const sent = await issueInvoice(order.id, null);
  assert.deepEqual(sent, { number: `INV-${order.number}-2`, posted: true });
});

test("an answer is all or nothing", async () => {
  const { order, conversationId, customer } = await orderWithChat(10);
  const v1 = await invoiceOf(order.id);
  await prisma.chatMessage.create({ data: { id: chatMessageIdFor(v1.id, "answer"), conversationId, sender: "staff", body: "in the way" } });
  await assert.rejects(answerInvoice(customer, { invoiceId: v1.id, answer: "confirmed" }));
  assert.equal((await invoiceOf(order.id)).answer, null, "the customer can still answer");
  await prisma.chatMessage.delete({ where: { id: chatMessageIdFor(v1.id, "answer") } });
  assert.equal((await answerInvoice(customer, { invoiceId: v1.id, answer: "confirmed" })).length, 2);
});
