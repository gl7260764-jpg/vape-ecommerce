// Downloads the free DB-IP "IP to City Lite" database used to place visitors on the map
// when the host doesn't send location headers (local runs, plain Node servers).
//
//   npm run geo:update
//
// IP Geolocation by DB-IP (https://db-ip.com), licensed CC BY 4.0. The analytics page credits it.
// DB-IP publishes a new file at the start of each month; run this monthly to stay current.
import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";

const dir = path.join(process.cwd(), "data", "geoip");
const target = path.join(dir, "dbip-city-lite.mmdb");

const month = (offset) => {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - offset);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

await mkdir(dir, { recursive: true });
for (const offset of [0, 1]) {
  const url = `https://download.db-ip.com/free/dbip-city-lite-${month(offset)}.mmdb.gz`;
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    console.log(`not available yet: ${url} (${res.status})`);
    continue;
  }
  const tmp = `${target}.download`;
  await pipeline(Readable.fromWeb(res.body), createGunzip(), createWriteStream(tmp));
  await rm(target, { force: true });
  await rename(tmp, target);
  console.log(`saved ${path.relative(process.cwd(), target)} (${((await stat(target)).size / 1e6).toFixed(0)} MB) from ${url}`);
  process.exit(0);
}
console.error("Could not download the DB-IP database. Try again later.");
process.exit(1);
