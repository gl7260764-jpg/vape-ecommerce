import "@/lib/test/env"; // must stay first: loads DATABASE_URL before the client is created
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { prisma } from "@/lib/db";
import { changeOrderStatus, updateOrder, type OrderEditInput } from "./edit";

// Order editing against the real database. Everything created carries a test- prefix and is removed after.
const stamp = randomUUID().slice(0, 8);
const orderIds: string[] = [];
let adminId: string;
let product: { id: string; name: string; priceCents: number };

const details = {
  fullName: "Edit Tester",
  email: `test.edit.${stamp}@example.com`,
  phone: "0412 345 678",
  addressLine1: "14 George Street",
  addressLine2: "",
  suburb: "Sydney",
  state: "NSW",
  postcode: "2000",
};

async function makeOrder(n: number, shippingCents = 5000) {
  const o = await prisma.order.create({
    data: {
      publicToken: `test-${stamp}-${n}`,
      paymentMethod: "bank_transfer",
      fullName: "Edit Tester",
      email: `test.edit.${stamp}@example.com`,
      phone: "+61412345678",
      addressLine1: "12 George Street",
      suburb: "Sydney",
      state: "NSW",
      postcode: "2000",
      shippingCode: "express",
      shippingName: "Express shipping",
      shippingCents,
      subtotalCents: 12700,
      totalCents: 12700 + shippingCents,
      notes: "order edit test, safe to delete",
      items: {
        create: [
          { name: "Line A", slug: "line-a", unitPriceCents: 4400, quantity: 2, lineTotalCents: 8800 },
          { name: "Line B", slug: "line-b", unitPriceCents: 3900, quantity: 1, lineTotalCents: 3900 },
        ],
      },
    },
    include: { items: { orderBy: { name: "asc" } } },
  });
  orderIds.push(o.id);
  return o;
}

before(async () => {
  adminId = (await prisma.adminUser.create({ data: { email: `test.edit.${stamp}@example.com`, name: "Edit Test Staff", passwordHash: "x", role: "staff" } })).id;
  product = await prisma.product.findFirstOrThrow({ where: { status: "active", isPurchasable: true }, select: { id: true, name: true, priceCents: true } });
});

after(async () => {
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.adminUser.deleteMany({ where: { id: adminId } });
  await prisma.$disconnect();
});

test("updateOrder recomputes totals and rejects bad lines", async () => {
  const o = await makeOrder(1);
  const [a, b] = o.items;
  const input = {
    details,
    shippingCode: "express",
    paymentMethod: "payid",
    items: [
      { id: a.id, name: "Line A", quantity: 3, unitPriceCents: 4400 },
      { productId: product.id, name: product.name, quantity: 1, unitPriceCents: 1000 },
    ],
    totalCents: 1, // a browser can't set totals
  } as OrderEditInput;
  assert.deepEqual(await updateOrder(o.id, input), { ok: true });
  const saved = await prisma.order.findUniqueOrThrow({ where: { id: o.id }, include: { items: { orderBy: { lineTotalCents: "desc" } } } });
  assert.equal(saved.subtotalCents, 3 * 4400 + 1000);
  assert.equal(saved.totalCents, 3 * 4400 + 1000 + 5000);
  assert.equal(saved.items.length, 2, "Line B was removed");
  assert.ok(!saved.items.some((i) => i.id === b.id));
  assert.equal(saved.items[1].productId, product.id);
  assert.equal(saved.addressLine1, "14 George Street");
  assert.equal(saved.phone, "+61412345678");
  assert.equal(saved.paymentMethod, "payid");

  const bad = async (items: OrderEditInput["items"], extra: Partial<OrderEditInput> = {}) => updateOrder(o.id, { details, shippingCode: "express", paymentMethod: "payid", items, ...extra });
  const zero = await bad([{ id: a.id, name: "Line A", quantity: 0, unitPriceCents: 4400 }]);
  assert.equal(zero.ok, false);
  assert.ok(!zero.ok && zero.fieldErrors?.["items.0.quantity"]);
  const hundred = await bad([{ id: a.id, name: "Line A", quantity: 100, unitPriceCents: 4400 }]);
  assert.ok(!hundred.ok && hundred.fieldErrors?.["items.0.quantity"]);
  const negative = await bad([{ id: a.id, name: "Line A", quantity: 1, unitPriceCents: -1 }]);
  assert.ok(!negative.ok && negative.fieldErrors?.["items.0.unitPriceCents"]);
  const empty = await bad([]);
  assert.ok(!empty.ok && empty.fieldErrors?.items);
  const email = await bad([{ id: a.id, name: "Line A", quantity: 1, unitPriceCents: 4400 }], { details: { ...details, email: "nope" } });
  assert.ok(!email.ok && email.fieldErrors?.email);
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).totalCents, 3 * 4400 + 1000 + 5000, "refused edits change nothing");
});

test("changing shipping takes the current price, keeping it keeps the old one", async () => {
  const o = await makeOrder(2, 1234);
  const items = o.items.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, unitPriceCents: i.unitPriceCents }));
  await updateOrder(o.id, { details, shippingCode: "express", paymentMethod: "bank_transfer", items });
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).shippingCents, 1234);
  const standard = await prisma.shippingMethod.findFirstOrThrow({ where: { code: "standard" } });
  await updateOrder(o.id, { details, shippingCode: "standard", paymentMethod: "bank_transfer", items });
  const saved = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
  assert.deepEqual([saved.shippingCode, saved.shippingName, saved.shippingCents], ["standard", standard.name, standard.priceCents]);
  assert.equal(saved.totalCents, 12700 + standard.priceCents);
});

test("changeOrderStatus records who and when", async () => {
  const o = await makeOrder(3);
  await changeOrderStatus(o.id, "paid", adminId);
  await changeOrderStatus(o.id, "paid", adminId); // no change, no entry
  const changes = await prisma.orderStatusChange.findMany({ where: { orderId: o.id } });
  assert.equal(changes.length, 1);
  assert.deepEqual([changes[0].from, changes[0].to, changes[0].adminId], ["pending_payment", "paid", adminId]);
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status, "paid");
});

test("an order's newsletter discount follows its items", async () => {
  const o = await makeOrder(4);
  await prisma.order.update({ where: { id: o.id }, data: { discountPercent: 10, discountCents: 1270, totalCents: 12700 - 1270 + 5000 } });
  const [a] = o.items;
  const result = await updateOrder(o.id, { details, shippingCode: "express", paymentMethod: "bank_transfer", items: [{ id: a.id, name: "Line A", quantity: 3, unitPriceCents: 4400 }] });
  assert.deepEqual(result, { ok: true });
  const saved = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
  assert.deepEqual([saved.subtotalCents, saved.discountPercent, saved.discountCents, saved.totalCents], [13200, 10, 1320, 13200 - 1320 + 5000]);
});
