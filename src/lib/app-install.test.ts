import "@/lib/test/env"; // must stay first: loads DATABASE_URL before the client is created
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { prisma } from "@/lib/db";
import { openAccount } from "./account";
import { appOffersFor, isInstalled, markAccountInstalled, recordAppInstall } from "./app-install";

// Against the real database: test-<stamp> visitors and devices, test.app.<stamp>@example.com emails.
const stamp = randomUUID().slice(0, 8);
const dev = (name: string) => `test-${stamp}-${name}`;
const mail = (name: string) => `test.app.${stamp}.${name}@example.com`;
const visitor = async (name: string, data: { appInstalledAt?: Date } = {}) =>
  (await prisma.visitor.create({ data: { id: dev(`v-${name}`), ...data }, select: { id: true } })).id;

after(async () => {
  await prisma.chatConversation.deleteMany({ where: { deviceTokenHash: { startsWith: `test-${stamp}` } } });
  await prisma.visitor.deleteMany({ where: { id: { startsWith: `test-${stamp}` } } });
  await prisma.discountRedemption.deleteMany({ where: { email: { startsWith: `test.app.${stamp}` } } });
  await prisma.customer.deleteMany({ where: { email: { startsWith: `test.app.${stamp}` } } });
  await prisma.$disconnect();
});

test("installing marks the visitor and the signed-in account", async () => {
  const visitorId = await visitor("mark");
  const email = mail("mark");
  await openAccount(dev("mark"), email);
  await recordAppInstall({ visitorId, tokenHash: dev("mark"), platform: "iPhone" });
  const v = await prisma.visitor.findUniqueOrThrow({ where: { id: visitorId } });
  assert.ok(v.appInstalledAt);
  assert.equal(v.appPlatform, "iPhone");
  const c = await prisma.customer.findUniqueOrThrow({ where: { email } });
  assert.ok(c.appInstalledAt);
  await recordAppInstall({ visitorId, tokenHash: dev("mark"), platform: "iPhone" });
  const again = await prisma.visitor.findUniqueOrThrow({ where: { id: visitorId } });
  assert.equal(again.appInstalledAt?.getTime(), v.appInstalledAt.getTime(), "the first install date is kept");
});

test("signing in on an installed device marks the account", async () => {
  const visitorId = await visitor("later", { appInstalledAt: new Date() });
  const email = mail("later");
  await openAccount(dev("later"), email);
  await markAccountInstalled({ visitorId, tokenHash: dev("later") });
  assert.ok((await prisma.customer.findUniqueOrThrow({ where: { email } })).appInstalledAt);
});

test("installed by the device or by the account", async () => {
  const installedVisitor = await visitor("device", { appInstalledAt: new Date() });
  assert.equal(await isInstalled({ visitorId: installedVisitor, email: mail("anyone") }), true);
  const email = mail("account");
  await prisma.customer.create({ data: { email, appInstalledAt: new Date() } });
  assert.equal(await isInstalled({ visitorId: null, email }), true);
  assert.equal(await isInstalled({ visitorId: await visitor("fresh"), email: mail("fresh") }), false);
});

test("offers know when the welcome discount is used", async () => {
  const email = mail("used");
  await openAccount(dev("used"), email);
  await prisma.discountRedemption.create({ data: { email, percent: 10 } });
  assert.deepEqual(await appOffersFor(dev("used")), { welcomeUsed: true, signedIn: true });
  assert.deepEqual(await appOffersFor(dev("nobody")), { welcomeUsed: false, signedIn: false });
  assert.deepEqual(await appOffersFor(null), { welcomeUsed: false, signedIn: false });
});

test("an install that arrives before the visitor exists is not counted as recorded", async () => {
  const early = await recordAppInstall({ visitorId: dev("v-not-yet"), tokenHash: null, platform: "Android" });
  assert.equal(early, false, "the device should try again once its visit is stored");
  const visitorId = await visitor("not-yet");
  assert.equal(await recordAppInstall({ visitorId, tokenHash: null, platform: "Android" }), true);
  assert.equal(await recordAppInstall({ visitorId, tokenHash: null, platform: "Android" }), true, "already recorded counts as recorded");
});
