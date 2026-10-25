import "@/lib/test/env"; // must stay first: loads DATABASE_URL before the client is created
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { prisma } from "@/lib/db";
import { getStoreProfile, saveStoreProfile } from "@/lib/store-profile";
import { buildSnapshot, createInvoice } from "./service";

// Integration tests against the real database; everything created carries a test- prefix and is removed after.
const stamp = randomUUID().slice(0, 8);
let order: { id: string; number: number };
let productId: string;
let savedProfile: Awaited<ReturnType<typeof getStoreProfile>>;

before(async () => {
  savedProfile = await getStoreProfile();
  const product = await prisma.product.findFirstOrThrow({ where: { brandId: { not: null }, puffs: { not: null }, status: "active" }, select: { id: true } });
  productId = product.id;
  order = await prisma.order.create({
    data: {
      publicToken: `test-${stamp}-inv`,
      paymentMethod: "bank_transfer",
      fullName: "Invoice Tester",
      email: `test.invoice.${stamp}@example.com`,
      phone: "+61412345678",
      addressLine1: "12 George Street",
      addressLine2: "Unit 4",
      suburb: "Sydney",
      state: "NSW",
      postcode: "2000",
      shippingCode: "express",
      shippingName: "Express shipping",
      shippingCents: 5000,
      subtotalCents: 12700,
      totalCents: 17700,
      notes: "invoice test, safe to delete",
      items: {
        create: [
          { productId, name: "Test Bar - Banana Ice", slug: "test-bar", unitPriceCents: 4400, quantity: 2, lineTotalCents: 8800 },
          { name: "Test Pod - Grape", slug: "test-pod", unitPriceCents: 3900, quantity: 1, lineTotalCents: 3900 },
        ],
      },
    },
    select: { id: true, number: true },
  });
});

after(async () => {
  await saveStoreProfile(savedProfile);
  await prisma.order.deleteMany({ where: { id: order.id } });
  await prisma.$disconnect();
});

test("snapshot copies the order, items and business details", async () => {
  await saveStoreProfile({ email: null, phone: null, address: null, abn: null });
  const plain = await buildSnapshot(order.id, 1);
  assert.equal(plain.number, `INV-${order.number}`);
  assert.equal(plain.orderNumber, order.number);
  assert.equal(plain.taxInvoice, false);
  assert.equal(plain.business.website, "vapesupplieraustralia.com");
  assert.deepEqual(plain.billedTo, { name: "Invoice Tester", email: `test.invoice.${stamp}@example.com`, phone: "+61412345678" });
  assert.equal(plain.shipTo.addressLine1, "12 George Street");
  assert.equal(plain.shipTo.addressLine2, "Unit 4");
  assert.equal(plain.shipTo.shippingName, "Express shipping");
  assert.equal(plain.items.length, 2);
  assert.equal(plain.items[0].amountCents, 8800);
  assert.ok(plain.items[0].detail && /puffs/.test(plain.items[0].detail), "a catalog product gets its brand and puffs");
  assert.equal(plain.items[1].detail, null);
  assert.deepEqual([plain.subtotalCents, plain.shippingCents, plain.totalCents, plain.gstCents], [12700, 5000, 17700, 1609]);
  assert.equal(plain.paymentMethod, "bank_transfer");

  await saveStoreProfile({ email: "hello@example.com", phone: "+61400000000", address: "1 Shop St\nSydney NSW 2000", abn: "12345678901" });
  const tax = await buildSnapshot(order.id, 2);
  assert.equal(tax.taxInvoice, true);
  assert.equal(tax.number, `INV-${order.number}-2`);
  assert.deepEqual(tax.business, { website: "vapesupplieraustralia.com", email: "hello@example.com", phone: "+61400000000", address: "1 Shop St\nSydney NSW 2000", abn: "12345678901" });
});

test("createInvoice numbers versions and asks only while awaiting payment", async () => {
  const first = await createInvoice(order.id, { sentById: null });
  assert.equal(first.version, 1);
  assert.equal(first.number, `INV-${order.number}`);
  assert.equal(first.askConfirm, true);
  await prisma.order.update({ where: { id: order.id }, data: { status: "paid" } });
  const second = await createInvoice(order.id, { sentById: null });
  assert.equal(second.version, 2);
  assert.equal(second.number, `INV-${order.number}-2`);
  assert.equal(second.askConfirm, false);
  const stored = await prisma.invoice.findUniqueOrThrow({ where: { id: second.id } });
  assert.equal((stored.snapshot as { totalCents: number }).totalCents, 17700);
});

test("snapshot carries the newsletter discount", async () => {
  await prisma.order.update({ where: { id: order.id }, data: { discountPercent: 10, discountCents: 1270, totalCents: 12700 - 1270 + 5000 } });
  const s = await buildSnapshot(order.id, 9);
  assert.deepEqual([s.discountPercent, s.discountCents, s.totalCents, s.gstCents], [10, 1270, 16430, Math.round(16430 / 11)]);
  await prisma.order.update({ where: { id: order.id }, data: { discountPercent: 0, discountCents: 0, totalCents: 17700 } });
});

test("snapshot carries the discount label", async () => {
  const label = "Newsletter + app discount (20%)";
  await prisma.order.update({ where: { id: order.id }, data: { discountPercent: 20, discountCents: 2540, discountLabel: label, totalCents: 12700 - 2540 + 5000 } });
  const s = await buildSnapshot(order.id, 10);
  assert.equal(s.discountLabel, label);
  await prisma.order.update({ where: { id: order.id }, data: { discountPercent: 0, discountCents: 0, discountLabel: null, totalCents: 17700 } });
});
