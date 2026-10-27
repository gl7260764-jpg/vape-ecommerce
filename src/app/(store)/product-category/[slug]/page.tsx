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

function HeroFallback() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-[1400px] px-4 pt-28 pb-12 sm:px-6 md:pt-32 md:pb-16 lg:px-10">
        <div className="h-4 w-48 animate-pulse rounded bg-surface-2" />
        <div className="mt-8 h-14 w-2/3 animate-pulse rounded-lg bg-surface-2" />
        <div className="mt-5 h-5 w-1/2 animate-pulse rounded bg-surface-2" />
      </div>
    </section>
  );
}

export default function CategoryPage({ params, searchParams }: Props) {
  return (
    <>
      <Suspense fallback={<HeroFallback />}>
        <CategoryHero params={params} />
      </Suspense>
      <Suspense fallback={<ListingFallback />}>
        <CategoryListing params={params} searchParams={searchParams} />
      </Suspense>
      <Suspense>
        <CategoryAbout params={params} />
      </Suspense>
    </>
  );
}
