import assert from "node:assert/strict";
import { test } from "node:test";
import { DISCOUNT_LABEL, discountCents, NEWSLETTER_DISCOUNT_PERCENT, welcomeDiscount } from "./discount";

test("the newsletter discount is 10% of the items, rounded to the cent", () => {
  assert.equal(NEWSLETTER_DISCOUNT_PERCENT, 10);
  assert.equal(discountCents(4700, 10), 470);
  assert.equal(discountCents(4705, 10), 471);
  assert.equal(discountCents(0, 10), 0);
  assert.equal(discountCents(4700, 0), 0);
  assert.equal(DISCOUNT_LABEL(10), "Newsletter discount (10%)");
});

test("welcome discount stacks newsletter and app", () => {
  assert.deepEqual(welcomeDiscount({ subscribed: true, installed: false, used: false }), { percent: 10, label: "Newsletter discount (10%)" });
  assert.deepEqual(welcomeDiscount({ subscribed: false, installed: true, used: false }), { percent: 10, label: "App discount (10%)" });
  assert.deepEqual(welcomeDiscount({ subscribed: true, installed: true, used: false }), { percent: 20, label: "Newsletter + app discount (20%)" });
  assert.equal(welcomeDiscount({ subscribed: false, installed: false, used: false }), null);
  assert.equal(welcomeDiscount({ subscribed: true, installed: true, used: true }), null);
});
