import "@/lib/test/env"; // must stay first: loads DATABASE_URL before the client is created
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { prisma } from "@/lib/db";
import { accountLimiter } from "./rate-limit";

const stamp = randomUUID().slice(0, 8);
const email = `test.account.${stamp}@example.com`;

after(async () => {
  await prisma.loginAttempt.deleteMany({ where: { key: { in: [`account:email:${email}`, ...Array.from({ length: 11 }, (_, i) => `account:ip:test-${stamp}-${i}`)] } } });
  await prisma.$disconnect();
});

test("sign-in is rate limited per email", async () => {
  // Each try from a different address, so only the per-email limit (10 in 15 minutes) can trip.
  for (let i = 0; i < 10; i++) {
    assert.equal(await accountLimiter.isLimited(`test-${stamp}-${i}`, email), false, `try ${i + 1} is allowed`);
    await accountLimiter.record(`test-${stamp}-${i}`, email);
  }
  assert.equal(await accountLimiter.isLimited(`test-${stamp}-10`, email), true);
});

test("starting a chat is limited to 3 per address", async () => {
  const { chatStartLimiter } = await import("./rate-limit");
  const ip = `test-${stamp}-chat`;
  for (let i = 0; i < 3; i++) {
    assert.equal(await chatStartLimiter.isLimited(ip, `test.chat.${stamp}.${i}@example.com`), false, `start ${i + 1} is allowed`);
    await chatStartLimiter.record(ip, `test.chat.${stamp}.${i}@example.com`);
  }
  assert.equal(await chatStartLimiter.isLimited(ip, `test.chat.${stamp}.new@example.com`), true, "a fourth new chat from one address waits");
  await prisma.loginAttempt.deleteMany({ where: { key: { startsWith: "chat-start:" }, OR: [{ key: { contains: stamp } }] } });
});

test("sending an enquiry is limited to 3 per address", async () => {
  const { enquiryLimiter } = await import("./rate-limit");
  const ip = `test-${stamp}-enquiry`;
  for (let i = 0; i < 3; i++) {
    assert.equal(await enquiryLimiter.isLimited(ip, `test.enquiry.${stamp}.${i}@example.com`), false, `enquiry ${i + 1} is allowed`);
    await enquiryLimiter.record(ip, `test.enquiry.${stamp}.${i}@example.com`);
  }
  assert.equal(await enquiryLimiter.isLimited(ip, `test.enquiry.${stamp}.new@example.com`), true, "a fourth from one address waits");
  await prisma.loginAttempt.deleteMany({ where: { key: { startsWith: "enquiry:" }, OR: [{ key: { contains: stamp } }] } });
});
