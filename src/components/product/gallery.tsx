"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Img = { src: string; alt: string; width?: number | null; fill?: boolean };

/** Many store photos are ~300px. Pad small ones more so they render near their real size instead of going soft. */
const padFor = (width?: number | null) => (!width || width >= 700 ? "p-[8%]" : width >= 450 ? "p-[14%]" : "p-[22%]");

/** Large tile with pointer-follow zoom (sharp photos only), plus thumbnails when there is more than one photo. */
export function Gallery({ images, name }: { images: Img[]; name: string }) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const tile = useRef<HTMLDivElement>(null);
  const current = images[active] ?? images[0];
  const canZoom = (current?.width ?? 0) >= 600;

  const onMove = (e: React.PointerEvent) => {
    if (!canZoom || e.pointerType !== "mouse" || !tile.current) return;
    const r = tile.current.getBoundingClientRect();
    setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={tile}
        onPointerMove={onMove}
        onPointerLeave={() => setZoom(null)}
        className="relative aspect-square overflow-hidden rounded-[var(--radius-tile)] bg-tile"
      >
        {current && (
          <Image
            key={current.src}
            src={current.src}
            alt={current.alt || name}
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className={cn(
              "animate-in fade-in-0 transition-transform duration-300 ease-out motion-reduce:transition-none",
              current.fill ? "scale-[1.12] object-cover" : ["object-contain", padFor(current.width)],
              canZoom && "cursor-zoom-in"
            )}
            style={zoom ? { transform: `scale(${current.fill ? 1.9 : 1.7})`, transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
          />
        )}
      </div>
      {images.length > 1 && (
        <ul className="grid grid-cols-5 gap-3" aria-label="Product photos">
          {images.map((img, i) => (
            <li key={img.src}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === active}
                className={cn(
                  "relative block aspect-square w-full overflow-hidden rounded-xl bg-tile ring-offset-2 ring-offset-background transition",
                  i === active ? "ring-2 ring-primary" : "opacity-70 hover:opacity-100"
                )}
              >
                <Image src={img.src} alt="" fill sizes="96px" className={img.fill ? "scale-[1.12] object-cover" : "object-contain p-2"} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
