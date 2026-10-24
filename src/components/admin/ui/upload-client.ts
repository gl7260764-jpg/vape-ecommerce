// Browser side of the admin upload flow: shrink, then post to /admin/api/upload with progress.

const MAX_EDGE = 2000;

/** Shrinks big photos before upload: faster, and well under any request-size limit. */
export async function downscale(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 2_000_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file; // the server re-encodes anyway
  }
}

export type Uploaded = { key: string; url: string; width: number; height: number; hasBackground: boolean };

/** XHR rather than fetch, for real upload progress. Rejects with a message that names the file. */
export function uploadImage(
  file: File,
  options: { folder: "products" | "categories"; name: string; onProgress?: (pct: number) => void }
): Promise<Uploaded> {
  return downscale(file).then(
    (blob) =>
      new Promise<Uploaded>((resolve, reject) => {
        const body = new FormData();
        body.append("file", blob instanceof File ? blob : new File([blob], file.name.replace(/\.\w+$/, ".webp"), { type: blob.type || "image/webp" }));
        body.append("folder", options.folder);
        body.append("name", options.name);
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/admin/api/upload");
        xhr.upload.onprogress = (e) => e.lengthComputable && options.onProgress?.(Math.round((e.loaded / e.total) * 100));
        xhr.onload = () => {
          let parsed: { ok?: boolean; error?: string; data?: Uploaded } | null = null;
          try {
            parsed = JSON.parse(xhr.responseText);
          } catch {
            // non-JSON body: fall through to the HTTP status
          }
          if (xhr.status < 300 && parsed?.ok && parsed.data) resolve(parsed.data);
          else reject(new Error(parsed?.error ?? `${file.name} didn't upload (HTTP ${xhr.status}).`));
        };
        xhr.onerror = () => reject(new Error(`${file.name} didn't upload. Check your connection and try again.`));
        xhr.timeout = 60_000;
        xhr.ontimeout = () => reject(new Error(`${file.name} took too long to upload. Try again.`));
        xhr.send(body);
      })
  );
}
