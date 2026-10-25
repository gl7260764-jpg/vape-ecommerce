import "@/lib/test/env"; // must stay first: loads DATABASE_URL before the client is created
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, test } from "node:test";
import { prisma } from "@/lib/db";
import { getAlertTopic, saveAlertTopic, setAlertTransport } from "./alerts";
import { brevoTransport, setEmailTransport } from "./email";
import { createEnquiry, markEnquiry, notifyEnquiry } from "./enquiries";
import { CONTACT_EMAIL, SITE_URL } from "./site";

// Against the real database with ntfy and Brevo replaced. The store has one topic, so it's put back after.
const stamp = randomUUID().slice(0, 8);
const topic = `test-${stamp}`;
const email = (n: string) => `test.enquiry.${stamp}.${n}@example.com`;

let alerts: Record<string, unknown>[] = [];
let emails: { apiKey: string; body: Record<string, unknown> }[] = [];
let brevoDown = false;
setAlertTransport(async (_url, body) => void alerts.push(JSON.parse(body)));
setEmailTransport(async (_url, body, apiKey) => {
  if (brevoDown) throw new Error("brevo is down");
  emails.push({ apiKey, body: JSON.parse(body) });
});
let original: string | null = null;
before(async () => {
  original = await getAlertTopic();
  await saveAlertTopic(topic);
});
beforeEach(() => {
  alerts = [];
  emails = [];
  brevoDown = false;
  process.env.BREVO_API_KEY = "test-key";
});
after(async () => {
  await saveAlertTopic(original);
  await prisma.enquiry.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.$disconnect();
});

test("an enquiry is saved as sent", async () => {
  const { id } = await createEnquiry({ name: "  Sarah Tester ", email: email("a"), phone: "0412 345 678", message: "  Do you ship to Perth?  " });
  const row = await prisma.enquiry.findUniqueOrThrow({ where: { id } });
  assert.equal(row.name, "Sarah Tester");
  assert.equal(row.message, "Do you ship to Perth?");
  assert.equal(row.phone, "0412 345 678");
  assert.equal(row.handledAt, null);
});

test("the team gets a phone alert and an email they can reply to", async () => {
  const { id } = await createEnquiry({ name: "Sarah Tester", email: email("b"), phone: null, message: "Do you have Grape Ice in bulk?" });
  await notifyEnquiry(id);
  assert.deepEqual(alerts, [
    { topic, title: "New enquiry from Sarah Tester", message: "Do you have Grape Ice in bulk?", priority: 4, tags: ["envelope_with_arrow"], click: `${SITE_URL}/admin/enquiries` },
  ]);
  assert.equal(emails.length, 1);
  const sent = emails[0];
  assert.equal(sent.apiKey, "test-key");
  assert.deepEqual(sent.body.sender, { name: "Website enquiry", email: CONTACT_EMAIL });
  assert.deepEqual(sent.body.to, [{ email: CONTACT_EMAIL }]);
  assert.deepEqual(sent.body.replyTo, { email: email("b"), name: "Sarah Tester" });
  assert.equal(sent.body.subject, "New enquiry from Sarah Tester");
  const text = String(sent.body.textContent);
  for (const part of ["Sarah Tester", email("b"), "Do you have Grape Ice in bulk?", `${SITE_URL}/admin/enquiries`]) assert.ok(text.includes(part), part);
  assert.ok((await prisma.enquiry.findUniqueOrThrow({ where: { id } })).emailedAt, "the email is recorded");
});

test("without a Brevo key there's no email, and the alert still goes", async () => {
  delete process.env.BREVO_API_KEY;
  const { id } = await createEnquiry({ name: "No Key", email: email("c"), phone: null, message: "Hello" });
  await notifyEnquiry(id);
  assert.equal(emails.length, 0);
  assert.equal(alerts.length, 1);
  assert.equal((await prisma.enquiry.findUniqueOrThrow({ where: { id } })).emailedAt, null);
});

test("Brevo failing never breaks the enquiry", async () => {
  brevoDown = true;
  const { id } = await createEnquiry({ name: "Down Tester", email: email("d"), phone: null, message: "Hello" });
  await notifyEnquiry(id);
  assert.equal(alerts.length, 1);
  assert.equal((await prisma.enquiry.findUniqueOrThrow({ where: { id } })).emailedAt, null);
});

test("an enquiry can be marked done and opened again", async () => {
  const { id } = await createEnquiry({ name: "Done Tester", email: email("e"), phone: null, message: "Hello" });
  await markEnquiry(id, true);
  assert.ok((await prisma.enquiry.findUniqueOrThrow({ where: { id } })).handledAt);
  await markEnquiry(id, false);
  assert.equal((await prisma.enquiry.findUniqueOrThrow({ where: { id } })).handledAt, null);
});

test("Brevo that never answers is given up on", { timeout: 20_000 }, async () => {
  const silent = createServer(() => {}); // takes the request, never replies
  await new Promise<void>((resolve) => silent.listen(0, "127.0.0.1", resolve));
  const { port } = silent.address() as AddressInfo;
  try {
    await assert.rejects(brevoTransport(`http://127.0.0.1:${port}`, "{}", "test-key"));
  } finally {
    silent.closeAllConnections();
    silent.close();
  }
});
