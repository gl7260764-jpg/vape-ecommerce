import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import productRedirects from "./prisma/data/catalog/product-redirects.json";

// The one address the site answers on; the store's other addresses redirect to it page for page.
// Keep in step with SITE_URL in src/lib/site.ts.
const MAIN_HOST = "vapesupplieraustralia.com";
const STORE_HOSTS = ["vapesupplieraustralia.com", "www.vapesupplieraustralia.com", "vapesupplieraustralia.com.au", "www.vapesupplieraustralia.com.au"];

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Old store URLs that map onto the new shop, and old product addresses -> current ones (duplicates merged
  // into one and messy slugs cleaned up: scripts/catalog/merge-duplicates.mts and clean-slugs.mts).
  async redirects() {
    return [
      // One address for the whole site (MAIN_HOST). (Vercel's domain settings redirect the others too; this
      // covers them if that's ever removed.)
      ...STORE_HOSTS.filter((host) => host !== MAIN_HOST).map((host) => ({
        source: "/:path*",
        has: [{ type: "host" as const, value: host }],
        destination: `https://${MAIN_HOST}/:path*`,
        permanent: true,
      })),
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

// Blog posts are MDX (src/content/blog); remark-gfm adds tables. Plugins are named as strings for Turbopack.
const withMDX = createMDX({ options: { remarkPlugins: ["remark-gfm"] } });

export default withMDX(nextConfig);
