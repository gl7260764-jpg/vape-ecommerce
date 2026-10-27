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
import { pageMetadata } from "@/lib/seo";

// The capital cities are where most Australians searching for a vape shop are; delivery reaches them all.
export const metadata = pageMetadata({
  title: { absolute: "Best Vape Shop Australia | Buy Disposable Vapes Online" },
  description:
    "Genuine IGET, Alibarbar and HQD disposables at bulk-buy prices, with tracked delivery to Sydney, Melbourne, Brisbane, Perth, Adelaide and all of Australia. Adults 18+.",
  path: "/",
});

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
