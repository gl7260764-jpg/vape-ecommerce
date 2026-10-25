import "@/lib/test/env"; // must stay first: loads DATABASE_URL before the client is created
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { prisma } from "@/lib/db";
import { forgetDevice } from "./customer-orders";

const stamp = randomUUID().slice(0, 8);
const dev = `test-${stamp}-shared`;
const keys = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" };

after(async () => {
  await prisma.pushSubscription.deleteMany({ where: { deviceTokenHash: dev } });
  await prisma.$disconnect();
});

test("signing out forgets the device's notifications too", async () => {
  await prisma.pushSubscription.create({ data: { endpoint: `https://push.example.com/${stamp}/shared`, ...keys, deviceTokenHash: dev } });
  await forgetDevice(dev);
  assert.equal(await prisma.pushSubscription.count({ where: { deviceTokenHash: dev } }), 0, "the next person on a shared phone gets nothing of theirs");
});
