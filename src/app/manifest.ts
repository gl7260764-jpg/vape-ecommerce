import type { MetadataRoute } from "next";

// Makes the store installable as an app. The icons are the lime "B" until the store has a logo file
// (regenerate them with `node scripts/app/icons.mjs`).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Best Vape Shop Australia",
    short_name: "Best Vape",
    description: "Genuine disposable vapes at bulk-buy prices, shipped Australia-wide. Adults 18+ only.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0d0e12",
    theme_color: "#0d0e12",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
