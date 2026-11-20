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

test("product titles lead with range, puffs and flavour, then what it is, within 60 characters when they can", () => {
  assert.equal(productTitle({ ...bar, name: "IGET Bar Grape Ice" }), "IGET Bar Grape Ice 3500 Puffs | Disposable Vape Australia", "puffs added");
  assert.equal(productTitle(bar), "IGET Bar 3500 Puffs - Strawberry Watermelon Ice | Vape AU", "a shorter label when the long one won't fit");
  assert.equal(
    productTitle({ ...bar, name: "HQD Cuvie Slick 6000 - Strawberry Kiwi", puffs: 6000 }),
    "HQD Cuvie Slick 6000 Puffs - Strawberry Kiwi | Vape AU",
    "the number is named as puffs, the way people search",
  );
  assert.equal(
    productTitle({ ...bar, name: "Geek Bar Pulse X Disposable Vape Device - Citrus Smash Ice", puffs: 25000 }),
    "Geek Bar Pulse X 25000 Puffs - Citrus Smash Ice | Vape AU",
    "import clutter out, puffs in",
  );
  assert.equal(productTitle({ ...bar, name: "Geek Bar Vape 9000 Puff - Blue Razz Ice", puffs: 9000 }), "Geek Bar Vape 9000 Puffs - Blue Razz Ice | Vape Australia");
  assert.equal(productTitle({ ...bar, name: "10 Pack IGET Bar Pro Bundle Australia" }), "10 Pack IGET Bar Pro Bundle Australia");
});

test("bulk packs are titled as bulk buys", () => {
  const pack = { ...bar, type: "bundle" as const };
  assert.equal(productTitle({ ...pack, name: "Bulk Buy 20 Pack HQD Slick" }), "Bulk Buy 20 Pack HQD Slick | Australia", "the name already says bulk buy");
  assert.equal(
    productTitle({ ...pack, name: "10 Pack - IGET Bar Pro 10000 Puffs - High-Puff Vape Bundle", packSize: 10, puffs: 10000 }),
    "10 Pack - IGET Bar Pro 10000 Puffs | Bulk Buy Australia",
  );
  assert.equal(productTitle({ ...pack, name: "IGET XXL 1800 Puffs - Blueberry Ice *5" }), "IGET XXL 1800 Puffs - Blueberry Ice 5 Pack | Bulk Buy AU");
  assert.equal(productTitle({ ...bar, name: "IGET Moon Mixed Flavours", packSize: 5 }), "IGET Moon Mixed Flavours (5 Pack) | Bulk Buy Australia", "pack size added");
});

test("product descriptions say what it is, the price, and how to buy it", () => {
  assert.equal(
    productDescription(bar),
    "Buy the IGET Bar 3,500-puff disposable vape in Strawberry Watermelon Ice for $44.00. Genuine stock with tracked delivery Australia-wide."
  );
  assert.equal(
    productDescription({ ...bar, nicotineMg: 50 }),
    "Buy the IGET Bar 3,500-puff disposable vape in Strawberry Watermelon Ice (50mg nicotine) for $44.00. Genuine stock with tracked delivery Australia-wide."
  );
  assert.equal(
    productDescription({ ...bar, name: "Bulk Buy 20 Pack IGET Bar Pro", type: "bundle", price: 599, packSize: 20, puffs: 10000, flavour: null }),
    "Bulk Buy 20 Pack IGET Bar Pro for $599.00, just $29.95 a vape (10,000 puffs each). Wholesale pricing with tracked delivery Australia-wide."
  );
  assert.equal(
    productDescription({ ...bar, type: "e_liquid", primary: { name: "E-Liquids", kind: "type" }, brand: { slug: "berry-drop", name: "Berry Drop" }, puffs: null, volumeMl: 30, nicotineMg: 20, flavour: "Grape", price: 24.95 }),
    "IGET Bar 3500 Puffs - Strawberry Watermelon Ice: 30ml 20mg Berry Drop e-liquid, $24.95. Buy vape juice online with tracked delivery Australia-wide."
  );
  assert.equal(
    productDescription({ ...bar, name: "SMOK Nord Pro Replacement Coils", type: "accessory", primary: { name: "Vape Accessories", kind: "type" }, puffs: null, flavour: null, price: 19.95 }),
    "Buy SMOK Nord Pro Replacement Coils for $19.95, from our vape accessories range. Tracked delivery Australia-wide."
  );
  for (const d of [productDescription(bar), productDescription({ ...bar, name: "x".repeat(90), packSize: 10, type: "bundle" })]) {
    assert.ok((d ?? "").length <= 160 || /x{90}/.test(d ?? ""), d ?? "");
  }
});

test("accessories take their category as the title label", () => {
  const coil = { ...bar, name: "SMOK Nord C Replacement Pod", type: "accessory" as const, primary: { name: "Vape Accessories", kind: "type" as const } };
  assert.equal(productTitle(coil), "SMOK Nord C Replacement Pod | Vape Accessories Australia");
});

test("mangled flavours from the import are left out", () => {
  for (const flavour of ["Grape Peach By", "Peach-Jam-Geek- - -X-", "Flavour Custom Pack", "Cereal Milk Melted Diamonds 5G"]) {
    assert.equal(
      productDescription({ ...bar, flavour }),
      "Buy IGET Bar 3500 Puffs - Strawberry Watermelon Ice, an IGET Bar 3,500-puff disposable vape for $44.00. Genuine stock with tracked delivery Australia-wide.",
      flavour,
    );
  }
  assert.match(productDescription({ ...bar, flavour: "Strawberry Watermelon-ice" }) ?? "", / in Strawberry Watermelon-ice for/, "hyphenated flavours are real");
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

test("category pages are titled the way each range is searched for", () => {
  const base = { count: 61, fromPrice: 29, brandSlug: "iget", metaTitle: null, metaDescription: null };
  assert.deepEqual(categorySeo({ ...base, slug: "iget-bar-australia", kind: "series", name: "IGET Bar", tagline: "The original IGET Bar, 3,500 puffs." }), {
    title: { absolute: "IGET Bar 3500 Puffs: All Flavours | Australia" },
    description: "The original IGET Bar, 3,500 puffs. Shop every IGET Bar flavour, 61 products from $29.00. Genuine stock, with tracked delivery to every state and territory.",
  });
  assert.deepEqual(
    categorySeo({ ...base, slug: "hqd-cuvie-slick-6000", kind: "series", name: "HQD Cuvie Slick 6000", tagline: "The slim HQD Cuvie Slick, 6,000 puffs." }).title,
    { absolute: "HQD Cuvie Slick 6000 Puffs: All Flavours | Australia" },
  );
  assert.deepEqual(categorySeo({ ...base, slug: "alibarbar", kind: "brand", name: "Alibarbar", tagline: "Gold-finish bars." }).title, { absolute: "Alibarbar Vapes Australia: All Flavours & Models" });
  assert.deepEqual(categorySeo({ ...base, slug: "nasty-juice", kind: "brand", name: "Nasty Juice", tagline: "Nasty Juice e-liquids." }).title, { absolute: "Nasty Juice E-Liquid Australia: All Flavours" });
  assert.deepEqual(categorySeo({ ...base, slug: "disposable-vapes", kind: "type", name: "Disposable Vapes", tagline: null }).title, { absolute: "Disposable Vapes Australia: Buy Vapes Online" });
  assert.equal(categorySeo({ ...base, slug: "freemax-coils", kind: "series", name: "Freemax Coils", tagline: "Replacement coils from Freemax." }).title, "Freemax Coils Australia", "coils have no flavours");
  assert.equal(categorySeo({ ...base, name: "Vapes Australia", count: 1, fromPrice: null, tagline: null, brandSlug: null }).title, "Vapes Australia");
  assert.equal(categorySeo({ ...base, slug: "alibarbar", kind: "brand", name: "Alibarbar", tagline: null, metaTitle: "Our Alibarbar range" }).title, "Our Alibarbar range", "the admin's title wins");
});

test("brand pages name the brand, count and lowest price", () => {
  assert.deepEqual(brandSeo({ name: "IGET", slug: "iget", count: 364, fromPrice: 15, ranges: ["IGET Bar", "IGET Bar Plus", "IGET Moon", "IGET Legend"] }), {
    title: "IGET Australia: Full Range",
    description: "All 364 IGET products we stock, from $15.00, with tracked delivery Australia-wide. Including IGET Bar, IGET Bar Plus, IGET Moon.",
  });
  assert.equal(brandSeo({ name: "Bar Juice 5000", slug: "bar-juice", count: 21, fromPrice: 30, ranges: [] }).title, "Bar Juice 5000: Full Range", "too long, and not its category's title");
});

test("a range that names its puffs doesn't get them twice", () => {
  const slick = { ...bar, name: "HQD Cuvie Slick 6000 - Strawberry Kiwi", puffs: 6000, flavour: "Strawberry Kiwi", price: 39, primary: { name: "HQD Cuvie Slick 6000", kind: "series" as const } };
  assert.equal(productDescription(slick), "Buy the HQD Cuvie Slick 6000 disposable vape in Strawberry Kiwi for $39.00. Genuine stock with tracked delivery Australia-wide.");
});
