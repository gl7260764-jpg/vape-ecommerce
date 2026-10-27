import type { Metadata } from "next";
import { ListingHero } from "@/components/store/listing-hero";
import { CollectionTile } from "@/components/store/collection-tile";
import { Reveal } from "@/components/motion/reveal";
import { getBrands } from "@/lib/catalog-queries";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "All Vape Brands",
  description: "IGET, HQD, Alibarbar, Geek Bar and every other vape brand we stock in Australia, in one place, with tracked delivery to every state and territory.",
  path: "/brands",
});

export default async function BrandsPage() {
  const brands = await getBrands();
  const total = brands.reduce((n, b) => n + b.count, 0);

  return (
    <>
      <ListingHero
        crumbs={[{ label: "Brands" }]}
        title="All brands"
        tagline={`${brands.length} brands and ${total.toLocaleString("en-AU")} products, from the big disposable names to e-liquid and accessory makers.`}
      />
      <section className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 md:py-20 lg:px-10">
        <Reveal className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5" stagger={0.04} y={24}>
          {brands.map((b, i) => (
            <CollectionTile key={b.slug} href={`/brand/${b.slug}`} name={b.name} count={b.count} image={b.image} priority={i < 4} />
          ))}
        </Reveal>
      </section>
    </>
  );
}
