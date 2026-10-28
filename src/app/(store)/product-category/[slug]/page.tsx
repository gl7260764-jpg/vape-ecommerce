import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListingHero } from "@/components/store/listing-hero";
import { Listing, ListingFallback } from "@/components/store/listing";
import { RichText } from "@/components/store/rich-text";
import { allCategorySlugs, getCategory } from "@/lib/catalog-queries";
import { categorySeo, pageMetadata } from "@/lib/seo";

type Props = PageProps<"/product-category/[slug]">;

export async function generateStaticParams() {
  return (await allCategorySlugs()).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCategory(slug);
  if (!c) return {};
  const { title, description } = categorySeo({ ...c, brandSlug: c.brand?.slug ?? null });
  return pageMetadata({ title, description, path: `/product-category/${slug}`, image: c.image });
}

async function CategoryHero({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const c = await getCategory(slug);
  if (!c) notFound();
  const crumbs = [
    { label: "Shop", href: "/shop" },
    ...(c.parent ? [{ label: c.parent.name, href: `/product-category/${c.parent.slug}` }] : []),
    { label: c.name },
  ];
  return (
    <ListingHero
      crumbs={crumbs}
      kicker={c.brand && c.kind !== "brand" ? { label: `More from ${c.brand.name}`, href: `/brand/${c.brand.slug}` } : null}
      title={c.name}
      tagline={c.tagline}
      count={c.count}
      image={c.image}
      links={c.children.map((child) => ({ label: child.name, href: `/product-category/${child.slug}` }))}
    />
  );
}

async function CategoryListing({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const { slug } = await params;
  return <Listing scope={{ category: slug }} searchParams={searchParams} basePath={`/product-category/${slug}`} />;
}

/** The store's own category copy, kept for search engines but tucked away below the products. */
async function CategoryAbout({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const c = await getCategory(slug);
  if (!c?.description) return null;
  return (
    <section className="border-t border-border">
      <details className="group mx-auto max-w-[1400px] px-4 py-12 sm:px-6 lg:px-10">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-display text-xl font-bold uppercase [&::-webkit-details-marker]:hidden">
          About {c.name}
          <span aria-hidden className="grid size-9 place-items-center rounded-full border border-border text-lg transition-transform group-open:rotate-45">
            +
          </span>
        </summary>
        <RichText html={c.description} className="mt-8 max-w-3xl" />
      </details>
    </section>
  );
}

// The hero (with the h1) and the store's copy prerender in place: every slug comes from generateStaticParams
// and the data is cached. Only the product grid waits for the request, because filters and sort live in the URL.
export default function CategoryPage({ params, searchParams }: Props) {
  return (
    <>
      <CategoryHero params={params} />
      <Suspense fallback={<ListingFallback />}>
        <CategoryListing params={params} searchParams={searchParams} />
      </Suspense>
      <CategoryAbout params={params} />
    </>
  );
}
