import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListingHero } from "@/components/store/listing-hero";
import { Listing, ListingFallback } from "@/components/store/listing";
import { allBrandSlugs, getBrand } from "@/lib/catalog-queries";
import { mediaUrl } from "@/lib/catalog";
import { brandSeo, pageMetadata } from "@/lib/seo";

type Props = PageProps<"/brand/[slug]">;

export async function generateStaticParams() {
  return (await allBrandSlugs()).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const b = await getBrand(slug);
  if (!b) return {};
  const { title, description } = brandSeo({ ...b, ranges: b.categories.filter((c) => c.kind === "series").map((c) => c.name) });
  // Brands with their own brand category (/product-category/alibarbar) list the same products there, so
  // search engines are pointed at that page, which also carries the store's copy.
  const home = b.categories.find((c) => c.kind === "brand");
  return pageMetadata({ title, description, path: home ? `/product-category/${home.slug}` : `/brand/${slug}`, image: b.image ? mediaUrl(b.image) : null });
}

async function BrandHero({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const b = await getBrand(slug);
  if (!b) notFound();
  const ranges = b.categories.filter((c) => c.kind !== "brand");
  return (
    <ListingHero
      crumbs={[{ label: "Brands", href: "/brands" }, { label: b.name }]}
      title={b.name}
      tagline={ranges.length ? `Shop the full ${b.name} line-up, from ${ranges[0].name} to the newest releases.` : `Everything we stock from ${b.name}.`}
      count={b.count}
      image={b.image ? mediaUrl(b.image) : null}
      links={ranges.map((c) => ({ label: c.name, href: `/product-category/${c.slug}` }))}
    />
  );
}

async function BrandListing({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const { slug } = await params;
  return <Listing scope={{ brand: slug }} searchParams={searchParams} basePath={`/brand/${slug}`} />;
}

export default function BrandPage({ params, searchParams }: Props) {
  return (
    <>
      <Suspense
        fallback={
          <section className="border-b border-border">
            <div className="mx-auto h-[22rem] max-w-[1400px] animate-pulse px-4 pt-28 sm:px-6 lg:px-10" />
          </section>
        }
      >
        <BrandHero params={params} />
      </Suspense>
      <Suspense fallback={<ListingFallback />}>
        <BrandListing params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}
