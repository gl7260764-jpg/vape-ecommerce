import assert from "node:assert/strict";
import { test } from "node:test";
import { deliveryCents, FREE_DELIVERY_FROM_CENTS, MIN_ORDER_CENTS, shortOfMinimumCents } from "./checkout";

const options = [2000, 5000]; // Regular $20, Express $50

test("orders start at $100 of items", () => {
  assert.equal(MIN_ORDER_CENTS, 10000);
  assert.equal(shortOfMinimumCents(9999), 1);
  assert.equal(shortOfMinimumCents(4400), 5600);
  assert.equal(shortOfMinimumCents(10000), 0);
  assert.equal(shortOfMinimumCents(25000), 0);
});

test("delivery costs its price under $500", () => {
  assert.equal(deliveryCents(2000, options, 49999), 2000);
  assert.equal(deliveryCents(5000, options, 49999), 5000);
});

test("from $500, Regular is free and Express costs the difference", () => {
  assert.equal(FREE_DELIVERY_FROM_CENTS, 50000);
  assert.equal(deliveryCents(2000, options, 50000), 0);
  assert.equal(deliveryCents(5000, options, 50000), 3000);
  assert.equal(deliveryCents(5000, options, 120000), 3000);
});

test("free delivery follows the cheapest option the store offers", () => {
  assert.equal(deliveryCents(4500, [1500, 4500], 60000), 3000, "a cheaper Regular takes more off Express");
  assert.equal(deliveryCents(5000, [5000], 60000), 0, "one option: free");
  assert.equal(deliveryCents(5000, [], 60000), 0, "the option itself counts when the list is empty");
});
