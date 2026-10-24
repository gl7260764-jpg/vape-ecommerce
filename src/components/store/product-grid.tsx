import { ProductCard } from "@/components/site/product-card";
import type { Product } from "@/lib/catalog";

/** Responsive grid; cards fade up in a short cascade when a page of results arrives. */
export function ProductGrid({ items, priorityCount = 4 }: { items: Product[]; priorityCount?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:gap-x-5 lg:gap-y-12 2xl:grid-cols-4">
      {items.map((product, i) => (
        <li
          key={product.id}
          className="animate-in fade-in-0 slide-in-from-bottom-3 fill-mode-both duration-500 motion-reduce:animate-none"
          style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
        >
          <ProductCard product={product} priority={i < priorityCount} sizes="(min-width: 1536px) 18vw, (min-width: 768px) 26vw, 46vw" />
        </li>
      ))}
    </ul>
  );
}

export function ProductGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <ul aria-label="Loading products" className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:gap-x-5 lg:gap-y-12 2xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <div className="aspect-[4/5] animate-pulse rounded-[var(--radius-tile)] bg-surface-2" />
          <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-surface-2" />
          <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-surface-2" />
        </li>
      ))}
    </ul>
  );
}
