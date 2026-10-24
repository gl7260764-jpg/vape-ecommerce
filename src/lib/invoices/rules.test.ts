import assert from "node:assert/strict";
import { test } from "node:test";
import { canAnswerInvoice, confirmationState, gstCents, invoiceNumber, invoiceStatus } from "./rules";

test("invoice numbers: INV-<order> first, then -2, -3", () => {
  assert.equal(invoiceNumber(10053, 1), "INV-10053");
  assert.equal(invoiceNumber(10053, 2), "INV-10053-2");
  assert.equal(invoiceNumber(10053, 3), "INV-10053-3");
});

test("GST is one eleventh of the total, rounded to the cent", () => {
  assert.equal(gstCents(17700), 1609);
  assert.equal(gstCents(0), 0);
});

test("the badge follows the order, and an older invoice is replaced", () => {
  assert.equal(invoiceStatus("pending_payment", true), "payment_due");
  assert.equal(invoiceStatus("paid", true), "paid");
  assert.equal(invoiceStatus("processing", true), "paid");
  assert.equal(invoiceStatus("shipped", true), "paid");
  assert.equal(invoiceStatus("delivered", true), "paid");
  assert.equal(invoiceStatus("cancelled", true), "cancelled");
  assert.equal(invoiceStatus("paid", false), "replaced");
  assert.equal(invoiceStatus("pending_payment", false), "replaced");
});

test("the question can only be answered on the newest invoice while payment is due", () => {
  const base = { latest: true, askConfirm: true, answer: null, status: "payment_due" } as const;
  assert.equal(canAnswerInvoice(base), true);
  assert.equal(canAnswerInvoice({ ...base, status: "paid" }), false, "never after payment");
  assert.equal(canAnswerInvoice({ ...base, status: "cancelled" }), false);
  assert.equal(canAnswerInvoice({ ...base, latest: false, status: "replaced" }), false);
  assert.equal(canAnswerInvoice({ ...base, answer: "confirmed" }), false);
  assert.equal(canAnswerInvoice({ ...base, askConfirm: false }), false);
});

test("'Not confirmed yet' only while the order awaits payment", () => {
  const asked = { askConfirm: true, answer: null };
  assert.equal(confirmationState(asked, "pending_payment"), "waiting");
  assert.equal(confirmationState(asked, "paid"), null, "paid without tapping: nothing left to confirm");
  assert.equal(confirmationState({ askConfirm: true, answer: "confirmed" }, "paid"), "confirmed");
  assert.equal(confirmationState({ askConfirm: true, answer: "disputed" }, "pending_payment"), "disputed");
  assert.equal(confirmationState({ askConfirm: false, answer: null }, "paid"), null);
  assert.equal(confirmationState(null, "pending_payment"), null);
});
