import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Old store URLs that map onto the new shop.
  async redirects() {
    return [
      { source: "/budget-friendly", destination: "/shop?price=under-25", permanent: true },
      { source: "/product-category/uncategorized", destination: "/shop", permanent: true },
    ];
  },
  // The service worker must never be cached, or a fixed one would take a day to reach people.
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] }];
  },
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
