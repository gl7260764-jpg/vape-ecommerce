import "@/lib/test/env"; // must stay first: loads DATABASE_URL before the client is created
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { prisma } from "@/lib/db";
import { openAccount } from "@/lib/account";
import { ChatError } from "./service";
import { startChat } from "./start";

// Against the real database: test-<stamp> devices, test.start.<stamp>@example.com emails.
const stamp = randomUUID().slice(0, 8);
const dev = (name: string) => `test-${stamp}-${name}`;
const mail = (name: string) => `test.start.${stamp}.${name}@example.com`;

after(async () => {
  await prisma.chatConversation.deleteMany({ where: { deviceTokenHash: { startsWith: `test-${stamp}` } } });
  await prisma.customer.deleteMany({ where: { email: { startsWith: `test.start.${stamp}` } } });
  await prisma.$disconnect();
});

test("a first message opens the account and lands in the chat", async () => {
  const email = mail("first");
  const result = await startChat(dev("first"), ` ${email.toUpperCase()} `, "Hi, do you have Banana Ice in stock?");
  assert.equal(result.email, email);
  assert.ok(await prisma.customer.findUnique({ where: { email } }), "the account exists");
  const conv = await prisma.chatConversation.findUniqueOrThrow({ where: { deviceTokenHash: dev("first") } });
  assert.equal(conv.id, result.conversationId);
  assert.equal(conv.lastMessagePreview, "Hi, do you have Banana Ice in stock?");
  assert.equal(conv.staffUnreadCount, 1);
  const messages = await prisma.chatMessage.findMany({ where: { conversationId: conv.id } });
  assert.deepEqual(messages.map((m) => [m.sender, m.body]), [["customer", "Hi, do you have Banana Ice in stock?"]]);
});

test("a signed-in device keeps its own chat", async () => {
  const a = mail("a");
  const { conversationId } = await openAccount(dev("signed"), a);
  const result = await startChat(dev("signed"), mail("b"), "hello again");
  assert.equal(result.email, a, "the device stays in its account");
  assert.equal(result.conversationId, conversationId);
  assert.equal(await prisma.chatMessage.count({ where: { conversationId, body: "hello again" } }), 1);
});

test("an empty message is refused before anything is created", async () => {
  await assert.rejects(startChat(dev("empty"), mail("empty"), "   "), (error: unknown) => error instanceof ChatError && error.code === "EMPTY");
  assert.equal(await prisma.chatConversation.count({ where: { deviceTokenHash: dev("empty") } }), 0);
});
