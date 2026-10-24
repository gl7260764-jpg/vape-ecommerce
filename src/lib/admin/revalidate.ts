import "server-only";
import { updateTag } from "next/cache";

// One helper per resource, called from create, update AND delete. Server actions only (updateTag).
// A failed invalidation is logged, never allowed to fail a write that already succeeded.

function expire(tags: string[]) {
  for (const tag of tags) {
    try {
      updateTag(tag);
    } catch (error) {
      console.error(`could not expire cache tag "${tag}"`, error);
    }
  }
}

/**
 * Products, categories and brands. Every storefront read (home, shop, category, brand,
 * product pages, header search) is cached under "catalog", product pages also under "product:<slug>".
 */
export function refreshCatalog(...productSlugs: (string | null | undefined)[]) {
  expire(["catalog", ...productSlugs.filter((s): s is string => Boolean(s)).map((s) => `product:${s}`)]);
}

/** Shipping methods shown at checkout. */
export function refreshShipping() {
  expire(["shipping"]);
}

/** The newsletter pop-up's settings, read by every store page. */
export function refreshNewsletter() {
  expire(["newsletter"]);
}
