import type { Metadata } from "next";
import { Suspense } from "react";
import { ListingHero } from "@/components/store/listing-hero";
import { Listing, ListingFallback } from "@/components/store/listing";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Shop All Vapes Online",
  description: "Every disposable vape, e-liquid, pod kit, nicotine pouch and accessory we stock, with filters for brand, flavour and price. Tracked delivery Australia-wide.",
  path: "/shop",
});

const QUICK_LINKS = [
  { label: "Disposables", href: "/shop?type=disposable" },
  { label: "Bundles and packs", href: "/shop?type=bundle" },
  { label: "E-liquids", href: "/shop?type=e_liquid" },
  { label: "Pod kits", href: "/shop?type=pod_kit" },
  { label: "Nicotine pouches", href: "/shop?type=nicotine_pouch" },
  { label: "Accessories", href: "/shop?type=accessory" },
];

export default function ShopPage({ searchParams }: PageProps<"/shop">) {
  return (
    <>
      <ListingHero
        crumbs={[{ label: "Shop" }]}
        title="Shop all"
        tagline="Every disposable, e-liquid, pouch and accessory we stock, in one place."
        links={QUICK_LINKS}
        hideOnMobile
      />
      {/* On phones the hero is hidden, so clear the fixed header here instead. */}
      <div className="pt-16 lg:pt-0">
        <Suspense fallback={<ListingFallback />}>
          <Listing scope={{}} searchParams={searchParams} basePath="/shop" />
        </Suspense>
      </div>
    </>
  );
}
