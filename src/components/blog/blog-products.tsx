import { ProductCard } from "@/components/site/product-card";
import { blogProductCards } from "@/lib/catalog-queries";

/**
 * Product picks inside a post, by address (`<Products slugs={["iget-bar-3500-puffs"]} />`), with live prices
 * and Add to cart. A product that's gone, or one awaiting legal review, is left out rather than shown broken.
 */
export async function BlogProducts({ slugs, title = "Shop the picks from this guide" }: { slugs: string[]; title?: string }) {
  const products = await blogProductCards(slugs);
  if (!products.length) return null;
  return (
    <section aria-label={title} className="my-10">
      <p className="font-display text-lg font-bold uppercase">{title}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        {products.map((p) => (
          <ProductCard key={p.slug} product={p} sizes="(min-width: 768px) 240px, 46vw" />
        ))}
      </div>
    </section>
  );
}
