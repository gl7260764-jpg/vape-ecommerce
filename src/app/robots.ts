import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// robots.txt: search engines may crawl the store, not the admin, account, checkout or order pages.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/account", "/checkout", "/order/", "/orders"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
