import "server-only";
import sanitizeHtml from "sanitize-html";

const OLD_SITE = /^https?:\/\/(www\.)?bestvapeshopaustralia\.com\.au/i;

/**
 * Store descriptions are WooCommerce HTML. Keep the structure, drop styling, scripts,
 * images and embeds, and point links at the old domain to the same path on this site.
 */
export function cleanDescription(html: string | null) {
  if (!html) return null;
  const clean = sanitizeHtml(html, {
    allowedTags: ["p", "br", "h2", "h3", "h4", "ul", "ol", "li", "strong", "b", "em", "i", "a", "blockquote", "table", "thead", "tbody", "tr", "th", "td"],
    allowedAttributes: { a: ["href", "title", "rel", "target"] },
    allowedSchemes: ["https", "http", "mailto"],
    transformTags: {
      h1: "h2",
      h5: "h4",
      h6: "h4",
      a: (tagName, attribs) => {
        const href = attribs.href ?? "";
        const next: Record<string, string> = OLD_SITE.test(href)
          ? { href: href.replace(OLD_SITE, "").replace(/\/$/, "") || "/" }
          : { href, rel: "nofollow noopener", target: "_blank" };
        return { tagName, attribs: next };
      },
    },
    exclusiveFilter: (frame) => ["p", "li", "h2", "h3", "h4", "strong"].includes(frame.tag) && !frame.text.trim(),
  });
  return clean.trim() || null;
}
