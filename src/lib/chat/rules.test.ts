import assert from "node:assert/strict";
import { test } from "node:test";
import { attachmentKind, canDelete, canEdit, isOnline, previewText, type Actor, type MessageFacts } from "./rules";

const t0 = new Date("2026-10-23T10:00:00Z");
const plus = (d: Date, ms: number) => new Date(d.getTime() + ms);
const customer: Actor = { kind: "customer", conversationId: "c1" };
const staff = (adminId: string, canModerate = false): Actor => ({ kind: "staff", adminId, canModerate });
const facts = (over: Partial<MessageFacts> = {}): MessageFacts => ({
  sender: "customer",
  staffId: null,
  conversationId: "c1",
  createdAt: t0,
  deletedAt: null,
  hasAttachment: false,
  ...over,
});

test("customer edits own text at any time", () => {
  const m = facts({ sender: "customer", createdAt: t0 });
  assert.equal(canEdit(m, customer), true);
  assert.equal(canEdit({ ...m, createdAt: plus(t0, -365 * 86_400_000) }, customer), true); // a year later still fine
  assert.equal(canEdit({ ...m, hasAttachment: true }, customer), false); // photos and PDFs can't be edited
  assert.equal(canEdit({ ...m, deletedAt: t0 }, customer), false);
});

test("staff edits only messages they sent", () => {
  const m = facts({ sender: "staff", staffId: "a1", createdAt: t0 });
  assert.equal(canEdit(m, staff("a1")), true);
  assert.equal(canEdit(m, staff("a2")), false);
  assert.equal(canEdit(facts({ sender: "customer" }), staff("a1", true)), false); // moderators can't rewrite customers
});

test("senders delete their own messages any time; moderators delete any non-system message", () => {
  const m = facts({ sender: "customer", createdAt: plus(t0, -30 * 86_400_000) });
  assert.equal(canDelete(m, customer), true);
  assert.equal(canDelete(m, staff("a1", true)), true);
  assert.equal(canDelete(m, staff("a1", false)), false);
  assert.equal(canDelete(facts({ sender: "staff", staffId: "a2" }), staff("a1", false)), false);
  assert.equal(canDelete({ ...m, deletedAt: t0 }, customer), false);
  assert.equal(canDelete(facts({ sender: "system" }), staff("a1", true)), false);
});

test("customer of another conversation can do nothing", () => {
  assert.equal(canDelete(facts({ sender: "customer", conversationId: "c2" }), customer), false);
  assert.equal(canEdit(facts({ sender: "customer", conversationId: "c2" }), customer), false);
});

test("online windows", () => {
  assert.equal(isOnline(plus(t0, -44_000), "customer", t0), true);
  assert.equal(isOnline(plus(t0, -46_000), "customer", t0), false);
  assert.equal(isOnline(plus(t0, -59_000), "staff", t0), true);
  assert.equal(isOnline(null, "staff", t0), false);
});

test("only photos and pdfs", () => {
  assert.equal(attachmentKind("image/svg+xml"), null);
  assert.equal(attachmentKind("text/html"), null);
  assert.equal(attachmentKind("application/msword"), null);
  assert.equal(attachmentKind("text/csv"), null);
  assert.equal(attachmentKind("image/png"), "image");
  assert.equal(attachmentKind("image/heic"), "image");
  assert.equal(attachmentKind("application/pdf"), "file");
});

test("preview text", () => {
  assert.equal(previewText({ body: "x", deletedAt: t0, attachmentKind: null, attachmentName: null }), "This message was deleted");
  assert.equal(previewText({ body: "", deletedAt: null, attachmentKind: "image", attachmentName: "a.webp" }), "Photo");
  assert.equal(previewText({ body: "", deletedAt: null, attachmentKind: "file", attachmentName: "receipt.pdf" }), "receipt.pdf");
  assert.equal(previewText({ body: "y".repeat(100), deletedAt: null, attachmentKind: null, attachmentName: null }).length, 81); // 80 + "…"
  assert.equal(previewText({ body: "  hi\n there ", deletedAt: null, attachmentKind: null, attachmentName: null }), "hi there");
});
