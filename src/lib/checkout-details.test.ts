import "@/lib/test/env"; // must stay first: loads DATABASE_URL before the client is created
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { prisma } from "@/lib/db";
import { savedCheckoutDetails } from "./checkout-details";

// Against the real database: test-<stamp> devices and orders, test.details.<stamp>@example.com emails.
const stamp = randomUUID().slice(0, 8);
const dev = (name: string) => `test-${stamp}-${name}`;
const mail = (name: string) => `test.details.${stamp}.${name}@example.com`;
const orderIds: string[] = [];

async function makeOrder(n: number, data: { email: string; fullName: string; addressLine1: string; createdAt: Date }) {
  const o = await prisma.order.create({
    data: {
      publicToken: `test-${stamp}-${n}`,
      paymentMethod: "payid",
      phone: "+61412345678",
      addressLine2: n === 2 ? "Unit 4" : null,
      suburb: "Sydney",
      state: "NSW",
      postcode: "2000",
      shippingCode: "standard",
      shippingName: "Regular shipping",
      shippingCents: 2000,
      subtotalCents: 4400,
      totalCents: 6400,
      notes: "checkout details test, safe to delete",
      ...data,
    },
  });
  orderIds.push(o.id);
  return o;
}

after(async () => {
  await prisma.chatConversation.deleteMany({ where: { deviceTokenHash: { startsWith: `test-${stamp}` } } });
  await prisma.orderAccess.deleteMany({ where: { tokenHash: { startsWith: `test-${stamp}` } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.$disconnect();
});

test("a device fills checkout from its own latest order", async () => {
  const email = mail("own");
  const older = await makeOrder(1, { email, fullName: "Old Name", addressLine1: "1 Old St", createdAt: new Date(Date.now() - 86_400_000) });
  const newer = await makeOrder(2, { email, fullName: "Avery Saved", addressLine1: "2 New St", createdAt: new Date() });
  await prisma.orderAccess.createMany({ data: [older, newer].map((o) => ({ tokenHash: dev("own"), orderId: o.id, fullDetails: true })) });
  assert.deepEqual(await savedCheckoutDetails(dev("own")), {
    fromOrder: true,
    fullName: "Avery Saved",
    email,
    phone: "0412 345 678",
    addressLine1: "2 New St",
    addressLine2: "Unit 4",
    suburb: "Sydney",
    state: "NSW",
    postcode: "2000",
  });
});

test("a device that only typed the email gets just the email", async () => {
  const email = mail("typed");
  const order = await makeOrder(3, { email, fullName: "Someone Else", addressLine1: "3 Private St", createdAt: new Date() });
  // Found by email (a summary), and signed in by typing it: neither proves it's theirs.
  await prisma.orderAccess.create({ data: { tokenHash: dev("typed"), orderId: order.id, fullDetails: false } });
  await prisma.chatConversation.create({ data: { deviceTokenHash: dev("typed"), customerName: email, customerEmail: email } });
  assert.deepEqual(await savedCheckoutDetails(dev("typed")), { fromOrder: false, email });
});

test("a fresh device gets nothing", async () => {
  assert.equal(await savedCheckoutDetails(dev("fresh")), null);
  assert.equal(await savedCheckoutDetails(null), null);
});
