// Uploads processed catalog images to the Neon "assets" bucket. Keys are content-hashed,
// so anything already in the bucket is skipped and objects can be cached forever.
// usage: node scripts/catalog/upload.mjs categories|products
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { Files } from "files-sdk";
import { neon } from "files-sdk/neon";

nextEnv.loadEnvConfig(process.cwd());

const kind = process.argv[2];
if (!["categories", "products"].includes(kind)) throw new Error("usage: upload.mjs categories|products");

const manifestPath = path.join(process.cwd(), ".catalog-cache", "images", `${kind}.json`);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const entries = Object.values(manifest).filter((e) => e.key && !e.error && !e.uploaded);
const assets = new Files({ adapter: neon({ bucket: "assets" }) });

let uploaded = 0;
let skipped = 0;
let failed = 0;
const queue = [...entries];

async function worker() {
  for (let entry = queue.shift(); entry; entry = queue.shift()) {
    try {
      if (await assets.exists(entry.key)) {
        skipped++;
      } else {
        const bytes = await readFile(path.join(process.cwd(), entry.file));
        await assets.upload(entry.key, bytes, {
          contentType: "image/webp",
          cacheControl: "public, max-age=31536000, immutable",
        });
        uploaded++;
      }
      entry.uploaded = true;
    } catch (error) {
      failed++;
      console.error(`failed ${entry.key}: ${error.message}`);
    }
    const n = uploaded + skipped + failed;
    if (n % 100 === 0) console.log(`  ${n}/${entries.length}`);
  }
}

await Promise.all(Array.from({ length: 8 }, worker));
await writeFile(manifestPath, JSON.stringify(manifest, null, kind === "categories" ? 1 : 0));
console.log(`${kind}: ${uploaded} uploaded, ${skipped} already there, ${failed} failed`);
if (failed) process.exitCode = 1;
