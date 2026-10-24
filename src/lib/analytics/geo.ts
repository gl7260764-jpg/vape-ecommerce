import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import { isIP } from "node:net";
import type { CityResponse, Reader } from "maxmind";
import { AU_STATES } from "@/lib/checkout";

export type Geo = { country: string | null; region: string | null; city: string | null };
const NONE: Geo = { country: null, region: null, city: null };

/** The visitor's address, from the proxy chain (first hop is the client). */
export function clientIpFrom(headers: Headers) {
  const raw = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "";
  const ip = raw.replace(/^::ffff:/, "");
  return isIP(ip) ? ip : null;
}

const isPrivate = (ip: string) =>
  /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(ip) || ip === "::1" || /^f[cd]/i.test(ip) || /^fe80/i.test(ip);

/** "NSW" -> "New South Wales" for Australia; other regions are kept as given. */
function regionName(country: string | null, region: string | null) {
  if (!region) return null;
  if (country === "AU") return AU_STATES.find((s) => s.code === region.toUpperCase())?.name ?? region;
  return region;
}

const decode = (v: string | null) => {
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
};

/** Free location headers added by the host: Vercel, then Cloudflare (city/region need its "visitor location" headers). */
function fromHeaders(h: Headers): Geo | null {
  const country = h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry");
  if (!country || country === "XX" || country === "T1") return null;
  const cc = country.toUpperCase();
  return {
    country: cc,
    region: regionName(cc, decode(h.get("x-vercel-ip-country-region") ?? h.get("cf-region-code") ?? h.get("cf-region"))),
    city: decode(h.get("x-vercel-ip-city") ?? h.get("cf-ipcity")),
  };
}

// --- Fallback: DB-IP Lite city database on disk (npm run geo:update). IP Geolocation by DB-IP, CC BY 4.0.

const DB_PATH = process.env.GEOIP_DB_PATH ?? path.join(process.cwd(), "data", "geoip", "dbip-city-lite.mmdb");
let reader: Promise<Reader<CityResponse> | null> | null = null;

function openReader() {
  reader ??= (async () => {
    // Read at runtime from disk; kept out of the server bundle on purpose (the file is ~130 MB).
    if (!existsSync(/*turbopackIgnore: true*/ DB_PATH)) return null;
    try {
      const maxmind = await import("maxmind");
      return await maxmind.open<CityResponse>(/*turbopackIgnore: true*/ DB_PATH);
    } catch (error) {
      console.error("could not open the IP location database", error);
      return null;
    }
  })();
  return reader;
}

async function fromDatabase(ip: string): Promise<Geo | null> {
  const db = await openReader();
  const rec = db?.get(ip);
  if (!rec?.country?.iso_code) return null;
  const country = rec.country.iso_code;
  return { country, region: regionName(country, rec.subdivisions?.[0]?.names?.en ?? null), city: rec.city?.names?.en ?? null };
}

/** Best available location for a request. Never throws; unknown is a valid answer. */
export async function locate(headers: Headers, ip: string | null): Promise<Geo> {
  try {
    const fromHost = fromHeaders(headers);
    if (fromHost) return fromHost;
    if (!ip || isPrivate(ip)) return NONE;
    return (await fromDatabase(ip)) ?? NONE;
  } catch {
    return NONE;
  }
}
