import "@/lib/test/env"; // must stay first: loads DATABASE_URL before the client is created
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { prisma } from "@/lib/db";
import { claimDiscount, subscribeEmail, welcomeDiscountFor } from "./newsletter";

// Against the real database; every email is test-<stamp>@example.com and is removed after.
const stamp = randomUUID().slice(0, 8);
const email = (n: number) => `test.news.${stamp}.${n}@example.com`;
const percentFor = async (e: string, visitorId: string | null = null) => (await welcomeDiscountFor(e, visitorId))?.percent ?? 0;

after(async () => {
  const emails = [1, 2, 3, 4, 5, 7].map(email);
  await prisma.visitor.deleteMany({ where: { id: `test-${stamp}-installed` } });
  await prisma.discountRedemption.deleteMany({ where: { email: { in: emails } } });
  await prisma.subscriber.deleteMany({ where: { email: { in: emails } } });
  await prisma.$disconnect();
});

test("a subscriber's next order qualifies, a stranger's doesn't", async () => {
  await subscribeEmail(email(1), "footer", null);
  assert.equal(await percentFor(email(1)), 10);
  assert.equal(await percentFor(email(1).toUpperCase()), 10, "emails match whatever the case");
  assert.equal(await percentFor(`nobody.${stamp}@example.com`), 0);
});

test("a discount can be claimed once", async () => {
  await subscribeEmail(email(2), "popup", null);
  const results = await Promise.all([
    prisma.$transaction((tx) => claimDiscount(tx, email(2), null, 10)),
    prisma.$transaction((tx) => claimDiscount(tx, email(2), null, 10)),
  ]);
  assert.deepEqual(results.sort(), [false, true]);
  assert.equal(await percentFor(email(2)), 0);
});

test("used discounts outlive the subscriber row", async () => {
  await subscribeEmail(email(3), "footer", null);
  await prisma.$transaction((tx) => claimDiscount(tx, email(3), null, 10));
  await prisma.subscriber.delete({ where: { email: email(3) } });
  assert.equal((await subscribeEmail(email(3), "popup", null)).discount, "used");
  assert.equal(await percentFor(email(3)), 0);
});

test("subscribeEmail says saved for a new email", async () => {
  assert.equal((await subscribeEmail(email(4), "popup", null)).discount, "saved");
  assert.equal((await prisma.subscriber.findUniqueOrThrow({ where: { email: email(4) } })).source, "popup");
});

test("a used welcome discount stays used", async () => {
  const visitorId = (await prisma.visitor.create({ data: { id: `test-${stamp}-installed`, appInstalledAt: new Date() } })).id;
  await subscribeEmail(email(5), "footer", null);
  assert.deepEqual(await welcomeDiscountFor(email(5), visitorId), { percent: 20, label: "Newsletter + app discount (20%)" });
  await prisma.$transaction((tx) => claimDiscount(tx, email(5), null, 20));
  assert.equal(await welcomeDiscountFor(email(5), visitorId), null);
});

test("subscribing says whether the email is new, so the team is told once", async () => {
  assert.equal((await subscribeEmail(email(7), "footer", null)).isNew, true);
  assert.equal((await subscribeEmail(email(7), "popup", null)).isNew, false);
});
