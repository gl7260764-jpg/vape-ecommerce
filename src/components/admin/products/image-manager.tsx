"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeftIcon, ArrowRightIcon, CircleNotchIcon, CornersOutIcon, UploadSimpleIcon, XIcon } from "@phosphor-icons/react";
import { mediaUrl } from "@/lib/catalog";
import { uploadImage } from "@/components/admin/ui/upload-client";
import type { ProductImageInput } from "@/lib/admin/schemas/product";
import { cn } from "@/lib/utils";

const MAX_IMAGES = 12;

type Pending = { id: string; name: string; preview: string; progress: number };

export function ImageManager({
  images,
  onChange,
  productName,
}: {
  images: ProductImageInput[];
  onChange: (images: ProductImageInput[]) => void;
  productName: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  // Uploads finish out of order; read the latest list when each one lands.
  const latest = useRef(images);
  useEffect(() => {
    latest.current = images;
  }, [images]);

  const addFiles = async (files: File[]) => {
    const room = MAX_IMAGES - images.length - pending.length;
    const accepted = files.filter((f) => f.type.startsWith("image/")).slice(0, Math.max(0, room));
    if (files.length > accepted.length) toast.error(room <= 0 ? `A product can have up to ${MAX_IMAGES} photos.` : "Only images can be added here.");

    await Promise.all(
      accepted.map(async (file) => {
        const id = crypto.randomUUID();
        const preview = URL.createObjectURL(file);
        setPending((p) => [...p, { id, name: file.name, preview, progress: 0 }]);
        try {
          const result = await uploadImage(file, {
            folder: "products",
            name: productName || file.name,
            onProgress: (progress) => setPending((p) => p.map((x) => (x.id === id ? { ...x, progress } : x))),
          });
          const next = [...latest.current, { key: result.key, alt: "", hasBackground: result.hasBackground, width: result.width, height: result.height }];
          latest.current = next;
          onChange(next);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : `${file.name} didn't upload.`);
        } finally {
          setPending((p) => p.filter((x) => x.id !== id));
          URL.revokeObjectURL(preview);
        }
      })
    );
  };

  const move = (from: number, to: number) => {
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((img, i) => (
          <li key={img.key} className="group relative overflow-hidden rounded-xl border border-border bg-tile">
            <div className="relative aspect-square">
              <Image
                src={mediaUrl(img.key)}
                alt={img.alt || `Photo ${i + 1}`}
                fill
                sizes="(min-width: 1024px) 180px, 45vw"
                className={img.hasBackground ? "scale-[1.12] object-cover" : "object-contain p-2"}
              />
            </div>
            {i === 0 && (
              <span className="absolute top-2 left-2 rounded-full bg-primary px-2 py-0.5 text-[0.68rem] font-semibold text-primary-foreground">Cover</span>
            )}
            <button
              type="button"
              onClick={() => onChange(images.filter((_, j) => j !== i))}
              aria-label={`Remove photo ${i + 1}`}
              className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-destructive hover:text-white"
            >
              <XIcon className="size-3.5" />
            </button>
            <div className="flex items-center justify-between gap-1 border-t border-border bg-surface px-1.5 py-1.5">
              <div className="flex">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                  aria-label={i === 1 ? "Make this the cover photo" : `Move photo ${i + 1} earlier`}
                  className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground disabled:opacity-30"
                >
                  <ArrowLeftIcon className="size-3.5" />
                </button>
                <button
                  type="button"
                  disabled={i === images.length - 1}
                  onClick={() => move(i, i + 1)}
                  aria-label={`Move photo ${i + 1} later`}
                  className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground disabled:opacity-30"
                >
                  <ArrowRightIcon className="size-3.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => onChange(images.map((x, j) => (j === i ? { ...x, hasBackground: !x.hasBackground } : x)))}
                aria-pressed={img.hasBackground}
                title="Fill the card edge to edge (for photos with their own background)"
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors",
                  img.hasBackground ? "bg-primary/15 text-primary-ink" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                )}
              >
                <CornersOutIcon className="size-3.5" aria-hidden />
                Fill
              </button>
            </div>
          </li>
        ))}

        {pending.map((p) => (
          <li key={p.id} className="relative overflow-hidden rounded-xl border border-border bg-tile">
            <div className="relative aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
              <img src={p.preview} alt="" className="absolute inset-0 size-full object-contain p-2 opacity-50" />
              <div className="absolute inset-0 grid place-items-center">
                <span className="flex items-center gap-2 rounded-full bg-background/85 px-3 py-1.5 text-xs font-medium backdrop-blur">
                  <CircleNotchIcon className="size-3.5 animate-spin" aria-hidden />
                  {p.progress < 100 ? `${p.progress}%` : "Processing"}
                </span>
              </div>
            </div>
            <div className="h-1 bg-surface-2">
              <div className="h-full bg-primary transition-[width]" style={{ width: `${p.progress}%` }} />
            </div>
            <p className="truncate border-t border-border bg-surface px-2.5 py-2.5 text-xs text-muted-foreground">{p.name}</p>
          </li>
        ))}

        {images.length + pending.length < MAX_IMAGES && (
          <li>
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                addFiles(Array.from(e.dataTransfer.files));
              }}
              className={cn(
                "flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center text-sm transition-colors",
                dragging ? "border-primary bg-primary/5 text-foreground" : "border-input text-muted-foreground hover:border-foreground/40 hover:text-foreground"
              )}
            >
              <UploadSimpleIcon className="size-5" aria-hidden />
              <span className="px-3 font-medium">Add photos</span>
              <span className="px-3 text-xs">Drop here or click. JPG, PNG, WebP</span>
            </button>
          </li>
        )}
      </ul>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <p className="mt-3 text-xs text-muted-foreground">
        The first photo is the cover. Turn on <span className="font-medium text-foreground">Fill</span> for photos with their own background so they cover the
        whole card; leave it off for cut-outs on white or transparent.
      </p>
    </div>
  );
}
