import "@/lib/test/env"; // must stay first: loads DATABASE_URL before the client is created
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, beforeEach, test } from "node:test";
import { prisma } from "@/lib/db";
import { setPushSender } from "./push";
import { broadcastProduct } from "./push-broadcast";

// Against the real database with the network call replaced: test-<stamp> products and endpoints.
const stamp = randomUUID().slice(0, 8);
const keys = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" };
const endpoint = (n: number) => `https://push.example.com/${stamp}/${n}`;

let sent: { endpoint: string; payload: { title: string; body: string; url: string; image?: string } }[] = [];
const gone = new Set<string>();
let duringSend: (() => Promise<void>) | null = null; // runs as each push goes out
setPushSender(async (subscription, payload) => {
  await duringSend?.();
  if (gone.has(subscription.endpoint)) return 410;
  sent.push({ endpoint: subscription.endpoint, payload: JSON.parse(payload) });
  return 201;
});
beforeEach(() => {
  sent = [];
});

async function product(n: number, withPhoto: boolean) {
  return prisma.product.create({
    data: {
      slug: `test-${stamp}-${n}`,
      name: `Test Banana Ice ${stamp} ${n}`,
      priceCents: 2200,
      regularPriceCents: 2200,
      ...(withPhoto ? { images: { create: { key: `products/test-${stamp}-${n}.webp`, position: 0 } } } : {}),
    },
  });
}

after(async () => {
  await prisma.pushBroadcast.deleteMany({ where: { title: { contains: stamp } } });
  await prisma.pushSubscription.deleteMany({ where: { endpoint: { startsWith: `https://push.example.com/${stamp}/` } } });
  await prisma.product.deleteMany({ where: { slug: { startsWith: `test-${stamp}` } } });
  await prisma.$disconnect();
});

test("everyone gets it and dead ones go", async () => {
  for (const n of [1, 2, 3]) await prisma.pushSubscription.create({ data: { endpoint: endpoint(n), ...keys, deviceTokenHash: `test-${stamp}-${n}` } });
  gone.add(endpoint(3));
  const p = await product(1, true);
  const result = await broadcastProduct({ productId: p.id, title: `Just in ${stamp}`, body: "$22.00. Tap to see it.", sentById: null });
  const mine = sent.filter((s) => s.endpoint.includes(stamp));
  assert.equal(mine.length, 2);
  assert.ok(result.sent >= 2, "every live device of the store gets it, ours included");
  assert.deepEqual(mine[0].payload, { title: `Just in ${stamp}`, body: "$22.00. Tap to see it.", url: `/product/${p.slug}`, image: `/media/products/test-${stamp}-1.webp`, tag: `product-${p.id}` });
  assert.equal(await prisma.pushSubscription.count({ where: { endpoint: endpoint(3) } }), 0, "a 410 deletes the subscription");
  const row = await prisma.pushBroadcast.findFirstOrThrow({ where: { title: `Just in ${stamp}` } });
  assert.equal(row.productId, p.id);
  assert.equal(row.sentCount, result.sent);
  assert.equal(row.url, `/product/${p.slug}`);
});

test("a product without a photo still sends", async () => {
  const p = await product(2, false);
  await broadcastProduct({ productId: p.id, title: `No photo ${stamp}`, body: "Tap to see it.", sentById: null });
  const mine = sent.filter((s) => s.endpoint.includes(stamp));
  assert.ok(mine.length > 0);
  assert.equal(mine[0].payload.image, undefined);
});

test("an unknown product is refused", async () => {
  await assert.rejects(broadcastProduct({ productId: `missing-${stamp}`, title: `Missing ${stamp}`, body: "x", sentById: null }));
  assert.equal(await prisma.pushBroadcast.count({ where: { title: `Missing ${stamp}` } }), 0);
});

test("the send is recorded before the first push goes out", async () => {
  await prisma.pushSubscription.create({ data: { endpoint: endpoint(4), ...keys, deviceTokenHash: `test-${stamp}-4` } });
  const p = await product(3, true);
  let recorded: boolean | null = null;
  duringSend = async () => {
    recorded ??= (await prisma.pushBroadcast.count({ where: { title: `Recorded first ${stamp}` } })) === 1;
  };
  await broadcastProduct({ productId: p.id, title: `Recorded first ${stamp}`, body: "x", sentById: null }).finally(() => (duringSend = null));
  assert.equal(recorded, true, "a send cut short still shows in the history");
});

test("once the pushes are out, a failure saving the count still reports them sent", async () => {
  const p = await product(4, true);
  duringSend = async () => {
    await prisma.pushBroadcast.deleteMany({ where: { title: `Count lost ${stamp}` } }); // the count can't be saved afterwards
  };
  const result = await broadcastProduct({ productId: p.id, title: `Count lost ${stamp}`, body: "x", sentById: null }).finally(() => (duringSend = null));
  assert.ok(result.sent > 0, "not an error telling the owner to send it again");
});
