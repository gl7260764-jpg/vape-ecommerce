import assert from "node:assert/strict";
import { test } from "node:test";
import { storedSlug } from "./catalog";

// Slugs imported from WooCommerce keep its encoding: 16″ is stored as "16%e2%80%b3".
test("every form of an encoded product address finds the stored slug", () => {
  const stored = "16%e2%80%b3-dopezilla-hydra-water-pipe-black";
  assert.equal(storedSlug("16″-dopezilla-hydra-water-pipe-black"), stored, "decoded, as the page receives it");
  assert.equal(storedSlug("16%E2%80%B3-dopezilla-hydra-water-pipe-black"), stored, "upper-case escapes");
  assert.equal(storedSlug(stored), stored, "the stored form itself");
});

test("ordinary product addresses are left alone", () => {
  assert.equal(storedSlug("banana-ice-iget-bar-3500-puffs"), "banana-ice-iget-bar-3500-puffs");
  assert.equal(storedSlug("50%-off"), "50%-off", "a stray % that isn't an escape is left as is");
  assert.equal(storedSlug("Banana-Ice"), "Banana-Ice", "only the escapes are lower-cased");
});
