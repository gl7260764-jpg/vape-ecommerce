import "server-only";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { slugify } from "@/lib/admin/slug";
import { attachmentKind, CHAT_FILE_KEY, MAX_UPLOAD_BYTES } from "@/lib/chat/rules";
import type { StoredAttachment } from "@/lib/chat/types";

// Chat files: photos (re-encoded to WebP, location data dropped) and PDFs (checked, stored as they are),
// under chat/<conversationId>/ in the private bucket. Served only through access-checked routes.

export class UploadError extends Error {
  constructor(
    readonly status: 413 | 415 | 422,
    message: string
  ) {
    super(message);
    this.name = "UploadError";
  }
}

/** Matches only keys this module writes, so a request can't walk out of a conversation's folder. */
export { CHAT_FILE_KEY };

/** A display name safe to store and show: no paths, no control characters, at most 120 characters. */
const displayName = (name: string) =>
  name
    .replace(/[\\/]/g, "_")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 120) || "file";

export async function storeChatFile(file: File, conversationId: string): Promise<StoredAttachment> {
  const kind = attachmentKind(file.type);
  if (!kind) throw new UploadError(415, "Only photos and PDFs can be sent.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError(413, `${displayName(file.name)} is over 4 MB. Send a smaller file.`);

  const { assets } = await import("@/lib/storage");
  const input = Buffer.from(await file.arrayBuffer());
  const base = slugify(file.name.replace(/\.[^.]+$/, ""), 40) || (kind === "image" ? "photo" : "document");
  const prefix = `chat/${conversationId}/${randomBytes(6).toString("hex")}-${base}`;

  if (kind === "image") {
    const out = await sharp(input, { limitInputPixels: 50_000_000 })
      .rotate() // apply EXIF orientation; metadata (including GPS) is not written to the output
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer({ resolveWithObject: true })
      .catch(() => {
        throw new UploadError(415, "We couldn't read that photo. Try a JPG or PNG.");
      });
    const key = `${prefix}.webp`;
    await assets.upload(key, out.data, { contentType: "image/webp" });
    return { key, name: displayName(file.name), mime: "image/webp", size: out.data.length, width: out.info.width, height: out.info.height };
  }

  if (input.subarray(0, 5).toString("latin1") !== "%PDF-") throw new UploadError(415, "That file isn't a valid PDF.");
  const key = `${prefix}.pdf`;
  await assets.upload(key, input, { contentType: "application/pdf" });
  const name = displayName(file.name);
  return { key, name: /\.pdf$/i.test(name) ? name : `${name}.pdf`, mime: "application/pdf", size: input.length, width: null, height: null };
}

/** Streams a chat file. Callers check access first; this only serves keys of the expected shape. */
export async function streamChatFile(key: string): Promise<Response> {
  if (!CHAT_FILE_KEY.test(key)) return new Response("Not found", { status: 404 });
  try {
    const { assets } = await import("@/lib/storage");
    const file = await assets.download(key);
    const filename = key.split("/").pop()!.replace(/^[a-f0-9]{12}-/, "");
    return new Response(file.stream(), {
      headers: {
        "Content-Type": key.endsWith(".pdf") ? "application/pdf" : "image/webp",
        "Content-Length": String(file.size),
        "Content-Disposition": `inline; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
