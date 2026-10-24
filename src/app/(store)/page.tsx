import { Hero } from "@/components/home/hero";
import { FlavourMarquee } from "@/components/home/flavour-marquee";
import { Categories } from "@/components/home/categories";
import { IgetShowcase } from "@/components/home/iget-showcase";
import { BulkPromo } from "@/components/home/bulk-promo";
import { Perks } from "@/components/home/perks";
import { HqdGrid } from "@/components/home/hqd-grid";
import { Reviews } from "@/components/home/reviews";
import { Faq } from "@/components/home/faq";
import { getHomeCatalog } from "@/lib/catalog-queries";

// Section order follows the live homepage: hero, categories, IGET carousel,
// disposables promo, trust badges, product grid, then brand copy and footer.
// Catalog data comes from Neon Postgres (cached, tag "catalog").
export default async function Home() {
  const catalog = await getHomeCatalog();

  return (
    <>
      <Hero />
      <FlavourMarquee names={catalog.flavourNames} />
      <Categories categories={catalog.categories} />
      <IgetShowcase products={catalog.iget} />
      <BulkPromo />
      <Perks />
      <HqdGrid products={catalog.hqd} />
      <Reviews />
      <Faq />
    </>
  );
}
