import assert from "node:assert/strict";
import { test } from "node:test";
import { nextShowDelay } from "./newsletter-schedule";

const DEFAULTS = { popupEnabled: true, firstDelaySeconds: 8, repeatEverySeconds: 10, maxShows: null, installOffersEnabled: true };
const FRESH = { subscribed: false, shows: 0, lastClosedAt: null };
const t = 1_800_000_000_000;

test("the first show waits the first delay from page load", () => {
  assert.equal(nextShowDelay(FRESH, DEFAULTS, t, t), 8000);
  assert.equal(nextShowDelay(FRESH, DEFAULTS, t + 3000, t), 5000);
});

test("after a close it comes back on the interval", () => {
  const closed = { subscribed: false, shows: 1, lastClosedAt: t };
  assert.equal(nextShowDelay(closed, DEFAULTS, t + 2000, t - 60_000), t + 10_000 - (t + 2000));
});

test("schedule continues after reload", () => {
  const closed = { subscribed: false, shows: 1, lastClosedAt: t };
  assert.equal(nextShowDelay(closed, DEFAULTS, t + 4000, t + 4000), 6000);
});

test("a long-ago close waits only the first delay from load", () => {
  const closed = { subscribed: false, shows: 3, lastClosedAt: t - 3_600_000 };
  assert.equal(nextShowDelay(closed, DEFAULTS, t, t), 8000);
});

test("a set number of times stops once reached", () => {
  const twice = { ...DEFAULTS, maxShows: 2 };
  assert.equal(nextShowDelay({ subscribed: false, shows: 2, lastClosedAt: t }, twice, t + 1000, t), null);
  assert.equal(nextShowDelay({ subscribed: false, shows: 1, lastClosedAt: t }, twice, t + 1000, t), 9000);
});

test("until they subscribe ignores how many times it has shown", () => {
  assert.equal(nextShowDelay({ subscribed: false, shows: 50, lastClosedAt: t }, DEFAULTS, t + 1000, t), 9000);
});

test("never for a subscriber, or when switched off", () => {
  assert.equal(nextShowDelay({ ...FRESH, subscribed: true }, DEFAULTS, t, t), null);
  assert.equal(nextShowDelay(FRESH, { ...DEFAULTS, popupEnabled: false }, t, t), null);
});
