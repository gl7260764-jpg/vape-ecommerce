import type { MetadataRoute } from "next";
import { sitemapCatalog } from "@/lib/catalog-queries";
import { SITE_URL } from "@/lib/site";

// sitemap.xml for search engines: submit https://vapesupplieraustralia.com/sitemap.xml in Google Search
// Console. Lists the store's public pages; account, checkout, order and admin pages stay out (see robots.ts).

const CONTACT_PAGE_CHANGED = new Date("2026-10-25");

type Entry = MetadataRoute.Sitemap[number];
const page = (path: string, lastModified: Date, changeFrequency: Entry["changeFrequency"], priority: number): Entry => ({
  url: `${SITE_URL}${path}`,
  lastModified,
  changeFrequency,
  priority,
});

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { products, categories, brands } = await sitemapCatalog();
  // The home page and listings change whenever a product does.
  const latest = new Date(Math.max(...products.map((p) => p.updatedAt.getTime()), CONTACT_PAGE_CHANGED.getTime()));
  return [
    page("", latest, "daily", 1),
    page("/shop", latest, "daily", 0.9),
    page("/categories", latest, "weekly", 0.7),
    page("/brands", latest, "weekly", 0.7),
    page("/contact", CONTACT_PAGE_CHANGED, "yearly", 0.4),
    ...products.map((p) => page(`/product/${p.slug}`, p.updatedAt, "weekly", 0.8)),
    ...categories.map((c) => page(`/product-category/${c.slug}`, c.updatedAt, "weekly", 0.7)),
    ...brands.map((b) => page(`/brand/${b.slug}`, b.updatedAt, "weekly", 0.6)),
  ];
}
