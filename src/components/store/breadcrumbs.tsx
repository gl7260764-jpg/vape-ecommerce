import Link from "next/link";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr";

export type Crumb = { label: string; href?: string };

/** Visible trail plus BreadcrumbList structured data for search results. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const trail = [{ label: "Home", href: "/" }, ...items];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.label, ...(c.href ? { item: c.href } : {}) })),
  };
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1.5">
        {trail.map((c, i) => (
          <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <CaretRightIcon aria-hidden className="size-3 shrink-0 opacity-60" />}
            {c.href && i < trail.length - 1 ? (
              <Link href={c.href} className="truncate transition-colors hover:text-foreground">
                {c.label}
              </Link>
            ) : (
              <span aria-current={i === trail.length - 1 ? "page" : undefined} className="truncate text-foreground/80">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </nav>
  );
}
