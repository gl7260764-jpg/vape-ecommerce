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
import { jsonLd, onlineStoreJsonLd, pageMetadata, SITE_NAME } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import { getPublicBusinessDetails } from "@/lib/store-profile";

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
  const [catalog, business] = await Promise.all([getHomeCatalog(), getPublicBusinessDetails()]);
  // Who runs the site, for Google's knowledge panel and AI answers.
  const data = {
    "@context": "https://schema.org",
    "@graph": [onlineStoreJsonLd(business), { "@type": "WebSite", name: SITE_NAME, url: SITE_URL, inLanguage: "en-AU", publisher: { "@id": `${SITE_URL}/#store` } }],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />
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
