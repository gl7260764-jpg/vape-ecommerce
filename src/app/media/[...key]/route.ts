import sharp from "sharp";
import { assets, PUBLIC_KEY } from "@/lib/storage";

// Streams catalog images out of the private Neon bucket. Keys carry a content hash,
// so responses can be cached forever by browsers and the CDN in front of the app.
// ?w= returns a WebP copy that wide (asked for by src/lib/image-loader.ts): product photos are stored up to
// 1080px, but a card on a phone is about 180px wide. The CDN keeps each size after the first request.

// The widths next/image asks for: Next's default device and image sizes.
const WIDTHS = new Set([16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840]);
const CACHE = "public, max-age=31536000, s-maxage=31536000, immutable";

export async function GET(request: Request, ctx: RouteContext<"/media/[...key]">) {
  const { key } = await ctx.params;
  const objectKey = key.join("/");
  if (!PUBLIC_KEY.test(objectKey)) {
    return new Response("Not found", { status: 404 });
  }
  const width = Number(new URL(request.url).searchParams.get("w"));

  try {
    const file = await assets.download(objectKey);
    if (!WIDTHS.has(width)) {
      return new Response(file.stream(), {
        headers: { "Content-Type": file.contentType, "Content-Length": String(file.size), "Cache-Control": CACHE },
      });
    }
    const original = Buffer.from(await new Response(file.stream()).arrayBuffer());
    const resized = await sharp(original).resize({ width, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
    return new Response(new Uint8Array(resized), {
      headers: { "Content-Type": "image/webp", "Content-Length": String(resized.length), "Cache-Control": CACHE },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
