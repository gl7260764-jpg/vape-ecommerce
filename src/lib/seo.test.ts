import assert from "node:assert/strict";
import { test } from "node:test";
import { brandSeo, categorySeo, productDescription, productTitle, type ProductSeoInput } from "./seo";

const bar: ProductSeoInput = {
  name: "IGET Bar 3500 Puffs - Strawberry Watermelon Ice",
  type: "disposable",
  price: 44,
  brand: { slug: "iget", name: "IGET" },
  primary: { name: "IGET Bar", kind: "series" },
  puffs: 3500,
  volumeMl: null,
  nicotineMg: null,
  packSize: 1,
  flavour: "Strawberry Watermelon Ice",
  shortDescription: "Disposable vape by IGET. 3,500 puffs.",
  metaTitle: null,
  metaDescription: null,
};

test("product titles add what Australians search for, within 60 characters when they can", () => {
  assert.equal(productTitle({ ...bar, name: "IGET Bar Grape Ice" }), "IGET Bar Grape Ice | Disposable Vape Australia");
  assert.equal(productTitle(bar), "IGET Bar 3500 Puffs - Strawberry Watermelon Ice | Australia", "too long for the label");
  assert.equal(productTitle({ ...bar, name: "Bulk Buy 20 Pack HQD Slick", type: "bundle" }), "Bulk Buy 20 Pack HQD Slick | Australia", "the name already says bulk buy");
  assert.equal(productTitle({ ...bar, name: "10 Pack IGET Bar Pro Bundle Australia" }), "10 Pack IGET Bar Pro Bundle Australia");
});

test("product descriptions lead with the product's details, not its title", () => {
  assert.equal(
    productDescription(bar),
    "A 3,500-puff disposable vape from the IGET Bar range in Strawberry Watermelon Ice, $44.00. Tracked delivery Australia-wide."
  );
  assert.equal(
    productDescription({ ...bar, name: "Bulk Buy 20 Pack IGET Bar Pro", type: "bundle", price: 599, packSize: 20, puffs: 10000, flavour: null }),
    "A 20-pack of 10,000-puff vapes from the IGET Bar range for $599.00, $29.95 a vape. Tracked delivery Australia-wide."
  );
  assert.equal(
    productDescription({ ...bar, type: "e_liquid", primary: { name: "E-Liquids", kind: "type" }, brand: { slug: "berry-drop", name: "Berry Drop" }, puffs: null, volumeMl: 30, nicotineMg: 20, flavour: "Grape", price: 24.95 }),
    "30ml 20mg e-liquid from Berry Drop in Grape, $24.95. Tracked delivery Australia-wide."
  );
  assert.equal(
    productDescription({ ...bar, name: "SMOK Nord Pro Replacement Coils", type: "accessory", primary: { name: "Vape Accessories", kind: "type" }, puffs: null, flavour: null, price: 19.95 }),
    "Vape Accessories: SMOK Nord Pro Replacement Coils, $19.95. Tracked delivery Australia-wide."
  );
});

test("accessories take their category as the title label", () => {
  const coil = { ...bar, name: "SMOK Nord C Replacement Pod", type: "accessory" as const, primary: { name: "Vape Accessories", kind: "type" as const } };
  assert.equal(productTitle(coil), "SMOK Nord C Replacement Pod | Vape Accessories Australia");
});

test("mangled flavours from the import are left out", () => {
  for (const flavour of ["Grape Peach By", "Peach-Jam-Geek- - -X-", "Flavour Custom Pack", "Cereal Milk Melted Diamonds 5G"]) {
    assert.equal(productDescription({ ...bar, flavour }), "A 3,500-puff disposable vape from the IGET Bar range, $44.00. Tracked delivery Australia-wide.", flavour);
  }
  assert.match(productDescription({ ...bar, flavour: "Strawberry Watermelon-ice" }) ?? "", / in Strawberry Watermelon-ice,/, "hyphenated flavours are real");
});

test("what the owner writes in the admin wins", () => {
  const written = { ...bar, metaTitle: "Strawberry Watermelon Ice IGET Bar", metaDescription: "Our best seller." };
  assert.equal(productTitle(written), "Strawberry Watermelon Ice IGET Bar");
  assert.equal(productDescription(written), "Our best seller.");
});

test("products awaiting legal review keep their plain title and summary", () => {
  const thc = { ...bar, name: "Blue Dream Muha Meds Disposable", brand: { slug: "muha-meds", name: "Muha Meds" } };
  assert.equal(productTitle(thc), "Blue Dream Muha Meds Disposable | Best Vape Shop Australia");
  assert.equal(productDescription(thc), bar.shortDescription);
  assert.equal(productDescription({ ...bar, type: "cbd" }), bar.shortDescription);
  const liquid = { ...bar, type: "e_liquid" as const, brand: null };
  assert.equal(productTitle({ ...liquid, name: "yCBG 2000mg CBG E-liquid 60ml" }), "yCBG 2000mg CBG E-liquid 60ml | Best Vape Shop Australia");
  assert.equal(productDescription({ ...liquid, name: "Zesty Pink E-Liquid 60ml (3000mg)", nicotineMg: 3000 }), bar.shortDescription, "a cannabinoid strength");
  assert.notEqual(productDescription({ ...liquid, name: "Berry Drop Grape 30ml", nicotineMg: 20 }), bar.shortDescription, "a nicotine strength");
  assert.deepEqual(categorySeo({ name: "Muha Meds", count: 27, fromPrice: 50, tagline: "Muha Meds disposables.", brandSlug: "muha-meds", metaTitle: null, metaDescription: null }), {
    title: "Muha Meds",
    description: "Muha Meds disposables.",
  });
});

test("category and brand pages name the range, count and lowest price", () => {
  assert.deepEqual(categorySeo({ name: "IGET Bar", count: 61, fromPrice: 29, tagline: "The original IGET Bar, 3,500 puffs.", brandSlug: "iget", metaTitle: null, metaDescription: null }), {
    title: "IGET Bar Australia",
    description: "The original IGET Bar, 3,500 puffs. Shop 61 products from $29.00, with tracked delivery to every state and territory.",
  });
  assert.equal(categorySeo({ name: "Vapes Australia", count: 1, fromPrice: null, tagline: null, brandSlug: null, metaTitle: null, metaDescription: null }).title, "Vapes Australia");
  assert.deepEqual(brandSeo({ name: "IGET", slug: "iget", count: 364, fromPrice: 15, ranges: ["IGET Bar", "IGET Bar Plus", "IGET Moon", "IGET Legend"] }), {
    title: "IGET Australia: Full Range",
    description: "All 364 IGET products we stock, from $15.00, with tracked delivery Australia-wide. Including IGET Bar, IGET Bar Plus, IGET Moon.",
  });
  assert.equal(brandSeo({ name: "Bar Juice 5000", slug: "bar-juice", count: 21, fromPrice: 30, ranges: [] }).title, "Bar Juice 5000: Full Range", "too long, and not its category's title");
});
