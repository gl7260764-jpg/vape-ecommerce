import { createHash } from "node:crypto";
import sharp from "sharp";
import { AdminAuthError, requireAdmin } from "@/lib/admin/auth";
import { slugify } from "@/lib/admin/slug";
import { mediaUrl } from "@/lib/catalog";
import { assets } from "@/lib/storage";

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const FOLDERS = new Set(["products", "categories"]);

const json = (body: unknown, status = 200) => Response.json(body, { status });

/**
 * A photo either sits on a plain backdrop (white or transparent, shown "contain" on the
 * store's tile) or carries its own background (shown "cover", filling the card).
 * Sample the border: mostly transparent or near-white means a plain backdrop.
 */
async function detectBackground(image: Buffer) {
  const { data, info } = await sharp(image).resize(64, 64, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let plain = 0;
  let total = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (x > 2 && x < info.width - 3 && y > 2 && y < info.height - 3) continue;
      const i = (y * info.width + x) * 4;
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
      if (a < 40 || (r > 232 && g > 232 && b > 232)) plain++;
      total++;
    }
  }
  return plain / total < 0.85;
}

/** Admin image upload: validated, re-encoded to WebP (EXIF stripped), content-hashed key, stored in the bucket. */
export async function POST(request: Request) {
  try {
    await requireAdmin("catalog:write");
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return json({ ok: false, error: error.code === "FORBIDDEN" ? "Your account can't upload images." : "Sign in to continue." }, error.code === "FORBIDDEN" ? 403 : 401);
    }
    throw error;
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: "That upload didn't come through. Try again." }, 400);
  }
  const file = form.get("file");
  const folder = String(form.get("folder") ?? "products");
  const name = slugify(String(form.get("name") ?? ""), 60) || "image";

  if (!(file instanceof File)) return json({ ok: false, error: "Choose an image to upload." }, 400);
  if (!FOLDERS.has(folder)) return json({ ok: false, error: "Unknown upload folder." }, 400);
  if (!TYPES.has(file.type)) return json({ ok: false, error: `${file.name} isn't a JPG, PNG, WebP or AVIF image.` }, 415);
  if (file.size > MAX_BYTES) return json({ ok: false, error: `${file.name} is over 10 MB. Use a smaller image.` }, 413);

  try {
    const { data, info } = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 50_000_000 })
      .rotate() // apply EXIF orientation; metadata (incl. GPS) is dropped on output
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85, alphaQuality: 90 })
      .toBuffer({ resolveWithObject: true });

    const hash = createHash("sha256").update(data).digest("hex").slice(0, 10);
    const key = `${folder}/${name}-${hash}.webp`;
    if (!(await assets.exists(key))) await assets.upload(key, data, { contentType: "image/webp" });

    return json({
      ok: true,
      data: { key, url: mediaUrl(key), width: info.width, height: info.height, hasBackground: await detectBackground(data) },
    });
  } catch (error) {
    console.error("admin upload failed", error);
    return json({ ok: false, error: `${file.name} couldn't be processed. Try a different image.` }, 422);
  }
}
