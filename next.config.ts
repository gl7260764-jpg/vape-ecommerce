import type { NextConfig } from "next";
import productRedirects from "./prisma/data/catalog/product-redirects.json";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Old store URLs that map onto the new shop, and old product addresses -> current ones (duplicates merged
  // into one and messy slugs cleaned up: scripts/catalog/merge-duplicates.mts and clean-slugs.mts).
  async redirects() {
    return [
      // One address for the whole site: www goes to the bare domain.
      { source: "/:path*", has: [{ type: "host", value: "www.vapesupplieraustralia.com" }], destination: "https://vapesupplieraustralia.com/:path*", permanent: true },
      { source: "/budget-friendly", destination: "/shop?price=under-25", permanent: true },
      { source: "/product-category/uncategorized", destination: "/shop", permanent: true },
      ...Object.entries(productRedirects).map(([from, to]) => ({ source: `/product/${from}`, destination: `/product/${to}`, permanent: true })),
    ];
  },
  // The service worker must never be cached, or a fixed one would take a day to reach people.
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] }];
  },
  // Vercel's image optimiser is billed per image, so on the free plan it stopped serving them. Catalog photos
  // are resized by our own /media route instead (src/lib/image-loader.ts); /public files load as they are.
  images: { loader: "custom", loaderFile: "./src/lib/image-loader.ts" },
  partialPrefetching: true,
  experimental: {
    // ~1,600 pages prerender in parallel against Neon; retry a page on a transient DB error instead of failing the build.
    staticGenerationRetryCount: 2,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
