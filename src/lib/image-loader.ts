"use client";

// next/image's loader (next.config.ts). Catalog photos come from /media, which serves a copy at the width the
// browser picked from the srcset (src/app/media/[...key]/route.ts); Vercel's own optimiser is billed per image
// and stopped serving on the free plan. Files in /public (hero stills, cut-outs) are served as they are.
export default function imageLoader({ src, width }: { src: string; width: number }) {
  return src.startsWith("/media/") ? `${src}?w=${width}` : src;
}
