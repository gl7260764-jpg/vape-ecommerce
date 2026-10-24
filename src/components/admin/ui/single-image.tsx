"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { CircleNotchIcon, ImageSquareIcon, UploadSimpleIcon } from "@phosphor-icons/react";
import { mediaUrl } from "@/lib/catalog";
import { uploadImage } from "@/components/admin/ui/upload-client";
import { BUTTON } from "@/components/admin/ui/primitives";
import { cn } from "@/lib/utils";

/** One image (category cover): preview, replace, remove. */
export function SingleImage({ value, onChange, name, folder }: { value: string | null; onChange: (key: string | null) => void; name: string; folder: "products" | "categories" }) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(`${file.name} isn't an image.`);
      return;
    }
    setProgress(0);
    try {
      const result = await uploadImage(file, { folder, name: name || "image", onProgress: setProgress });
      onChange(result.key);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `${file.name} didn't upload.`);
    } finally {
      setProgress(null);
    }
  };

  return (
    <div>
      <div className={cn("relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-tile", !value && "grid place-items-center")}>
        {value ? (
          <Image src={mediaUrl(value)} alt="" fill sizes="(min-width: 1024px) 360px, 90vw" className="object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-2 text-sm text-tile-foreground/60">
            <ImageSquareIcon className="size-6" aria-hidden />
            No image
          </span>
        )}
        {progress !== null && (
          <div className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-sm">
            <span className="flex items-center gap-2 rounded-full bg-background px-3 py-1.5 text-xs font-medium">
              <CircleNotchIcon className="size-3.5 animate-spin" aria-hidden />
              {progress < 100 ? `${progress}%` : "Processing"}
            </span>
          </div>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => input.current?.click()} disabled={progress !== null} className={cn(BUTTON.secondary, "h-9 flex-1 px-4")}>
          <UploadSimpleIcon className="size-4" aria-hidden />
          {value ? "Replace" : "Upload"}
        </button>
        {value && (
          <button type="button" onClick={() => onChange(null)} disabled={progress !== null} className={cn(BUTTON.secondary, "h-9 px-4 text-destructive")}>
            Remove
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
