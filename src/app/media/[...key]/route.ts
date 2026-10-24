import { assets, PUBLIC_KEY } from "@/lib/storage";

// Streams catalog images out of the private Neon bucket. Keys carry a content hash,
// so responses can be cached forever by browsers and the CDN in front of the app.
export async function GET(_request: Request, ctx: RouteContext<"/media/[...key]">) {
  const { key } = await ctx.params;
  const objectKey = key.join("/");
  if (!PUBLIC_KEY.test(objectKey)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const file = await assets.download(objectKey);
    return new Response(file.stream(), {
      headers: {
        "Content-Type": file.contentType,
        "Content-Length": String(file.size),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
