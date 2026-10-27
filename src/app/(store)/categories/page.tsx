import type { Metadata } from "next";
import { ListingHero } from "@/components/store/listing-hero";
import { CollectionTile } from "@/components/store/collection-tile";
import { Reveal } from "@/components/motion/reveal";
import { getCategories } from "@/lib/catalog-queries";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "All Vape Categories",
  description: "Browse disposables, e-liquids, pouches, accessories and every IGET, HQD, Alibarbar and Geek Bar range we stock, delivered tracked across Australia.",
  path: "/categories",
});

type Item = Awaited<ReturnType<typeof getCategories>>["types"][number];

function Group({ id, title, items, offset = 0 }: { id: string; title: string; items: Item[]; offset?: number }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby={id} className="mx-auto max-w-[1400px] px-4 py-12 sm:px-6 md:py-16 lg:px-10">
      <h2 id={id} className="font-display text-2xl leading-[0.95] font-extrabold tracking-[-0.02em] uppercase md:text-4xl">
        {title}
      </h2>
      <Reveal className="mt-8 grid grid-cols-2 gap-4 md:mt-10 md:grid-cols-3 lg:grid-cols-4 lg:gap-5" stagger={0.04} y={24}>
        {items.map((c, i) => (
          <CollectionTile
            key={c.slug}
            href={`/product-category/${c.slug}`}
            name={c.name}
            count={c.count}
            image={c.image}
            tagline={c.tagline}
            priority={offset + i < 4}
          />
        ))}
      </Reveal>
    </section>
  );
}

export default async function CategoriesPage() {
  const { types, ranges, collections, total } = await getCategories();
  return (
    <>
      <ListingHero
        crumbs={[{ label: "Categories" }]}
        title="All categories"
        tagline={`${total} categories, from product types to every range we stock.`}
        links={types.map((c) => ({ label: c.name, href: `/product-category/${c.slug}` }))}
      />
      <Group id="types" title="Shop by type" items={types} />
      <div className="border-t border-border">
        <Group id="ranges" title="Ranges and brands" items={ranges} offset={types.length} />
      </div>
      <div className="border-t border-border">
        <Group id="collections" title="Bulk buys" items={collections} offset={types.length + ranges.length} />
      </div>
    </>
  );
}
