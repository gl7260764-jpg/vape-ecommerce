// Snapshots the live WooCommerce store's public Store API into .catalog-cache/woo/.
// usage: node scripts/catalog/fetch-live.mjs
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const API = "https://bestvapeshopaustralia.com.au/wp-json/wc/store/v1";
const OUT = path.join(process.cwd(), ".catalog-cache", "woo");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, attempts = 4) {
  for (let i = 1; ; i++) {
    const res = await fetch(url, { headers: { "User-Agent": "catalog-import/1.0" } });
    if (res.ok) return { body: await res.json(), headers: res.headers };
    if (i >= attempts) throw new Error(`${res.status} ${url}`);
    await sleep(1000 * i);
  }
}

await mkdir(OUT, { recursive: true });

const { body: categories } = await get(`${API}/products/categories?per_page=100`);
await writeFile(path.join(OUT, "categories.json"), JSON.stringify(categories));
console.log(`categories: ${categories.length}`);

const first = await get(`${API}/products?per_page=100&page=1`);
const pages = Number(first.headers.get("x-wp-totalpages") ?? 1);
const products = [...first.body];
for (let page = 2; page <= pages; page++) {
  await sleep(300);
  const { body } = await get(`${API}/products?per_page=100&page=${page}`);
  products.push(...body);
}
await writeFile(path.join(OUT, "products.json"), JSON.stringify(products));
console.log(`products: ${products.length} (${pages} pages, total header ${first.headers.get("x-wp-total")})`);
