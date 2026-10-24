import "server-only";
import { Files } from "files-sdk";
import { neon } from "files-sdk/neon";
import { env } from "@/lib/env";

/** Private bucket declared in neon.ts. Read through /media/<key>, never exposed directly. */
export const assets = new Files({
  adapter: neon({
    bucket: "assets",
    endpoint: env.storage.endpoint,
    region: env.storage.region,
    accessKeyId: env.storage.accessKeyId,
    secretAccessKey: env.storage.secretAccessKey,
  }),
});

/** Object keys the media route will serve. Everything else in the bucket stays private. */
export const PUBLIC_KEY = /^(products|categories)\/[a-z0-9-]+\.(png|jpe?g|webp)$/;
