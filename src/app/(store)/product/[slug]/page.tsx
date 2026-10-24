import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowRightIcon, SealCheckIcon, TruckIcon } from "@phosphor-icons/react/dist/ssr";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { RichText } from "@/components/store/rich-text";
import { Gallery } from "@/components/product/gallery";
import { BuyBox } from "@/components/product/buy-box";
import { SpecTiles } from "@/components/product/spec-tiles";
import { ProductCard } from "@/components/site/product-card";
import { allProductSlugs, getProduct, type ProductDetail } from "@/lib/catalog-queries";
import { productMeta } from "@/lib/catalog";

type Props = PageProps<"/product/[slug]">;

const SITE = process.env.SITE_URL ?? "https://bestvapeshopaustralia.com.au";
const NICOTINE_TYPES = new Set(["disposable", "e_liquid", "nicotine_pouch", "bundle", "pod_kit"]);

export async function generateStaticParams() {
  return (await allProductSlugs()).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) return {};
  return {
    title: p.metaTitle ?? p.name,
    description: p.metaDescription ?? p.shortDescription ?? undefined,
    alternates: { canonical: `/product/${slug}` },
    openGraph: p.images[0] ? { images: [p.images[0].src] } : undefined,
  };
}

function productJsonLd(p: ProductDetail, slug: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    image: p.images.map((i) => `${SITE}${i.src}`),
    description: p.shortDescription ?? undefined,
    brand: p.brand ? { "@type": "Brand", name: p.brand.name } : undefined,
    category: p.primary?.name,
    offers: {
      "@type": "Offer",
      url: `${SITE}/product/${slug}`,
      priceCurrency: "AUD",
      price: p.card.price.toFixed(2),
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };
}

async function ProductView({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) notFound();

  const crumbs = [
    { label: "Shop", href: "/shop" },
    ...(p.primary?.parent ? [{ label: p.primary.parent.name, href: `/product-category/${p.primary.parent.slug}` }] : []),
    ...(p.primary ? [{ label: p.primary.name, href: `/product-category/${p.primary.slug}` }] : []),
    { label: p.name },
  ];

  return (
    <>
      <section className="mx-auto max-w-[1400px] px-4 pt-28 pb-16 sm:px-6 md:pt-32 lg:px-10">
        <Breadcrumbs items={crumbs} />
        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-7">
            <div className="lg:sticky lg:top-28">
              <Gallery images={p.images} name={p.name} />
            </div>
          </div>

          <div className="flex flex-col gap-8 lg:col-span-5">
            <div>
              {p.brand && (
                <Link href={`/brand/${p.brand.slug}`} className="text-sm font-medium text-primary-ink hover:underline">
                  {p.brand.name}
                </Link>
              )}
              <h1 className="mt-2 font-display text-[clamp(1.5rem,2.6vw,2.35rem)] leading-[1.05] font-extrabold tracking-[-0.02em] text-balance uppercase">
                {p.name}
              </h1>
              <p className="mt-3 text-muted-foreground">{productMeta(p.card)}</p>
            </div>

            <BuyBox product={p.card} name={p.name} />

            <ul className="grid gap-3 text-sm">
              <li className="flex items-center gap-3">
                <TruckIcon weight="duotone" className="size-5 shrink-0 text-primary-ink" />
                Tracked delivery to every state and territory
              </li>
              <li className="flex items-center gap-3">
                <SealCheckIcon weight="duotone" className="size-5 shrink-0 text-primary-ink" />
                Sealed stock from the brands you know
              </li>
            </ul>

            <SpecTiles product={p} />

            {NICOTINE_TYPES.has(p.type) && (
              <p className="rounded-2xl border border-border p-4 text-sm leading-relaxed text-muted-foreground">
                <strong className="font-semibold text-foreground">Warning:</strong> this product contains nicotine, a highly addictive substance.
              </p>
            )}
          </div>
        </div>
      </section>

      {p.description && (
        <section aria-labelledby="details-title" className="border-t border-border">
          <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-8 px-4 py-16 sm:px-6 md:py-20 lg:grid-cols-12 lg:gap-14 lg:px-10">
            <h2 id="details-title" className="font-display text-3xl leading-[0.95] font-extrabold tracking-[-0.03em] uppercase lg:col-span-4 lg:text-4xl">
              Product details
            </h2>
            <RichText html={p.description} className="lg:col-span-8 lg:max-w-3xl" />
          </div>
        </section>
      )}

      {p.related.length > 0 && p.primary && (
        <section aria-labelledby="related-title" className="border-t border-border bg-surface">
          <div className="mx-auto max-w-[1400px] px-4 py-16 sm:px-6 md:py-20 lg:px-10">
            <div className="flex items-end justify-between gap-6">
              <h2 id="related-title" className="font-display text-3xl leading-[0.95] font-extrabold tracking-[-0.03em] uppercase lg:text-4xl">
                More from {p.primary.name}
              </h2>
              <Link
                href={`/product-category/${p.primary.slug}`}
                className="group hidden h-11 shrink-0 items-center gap-2 rounded-full border border-foreground/20 pr-2 pl-5 text-sm font-medium transition-colors hover:border-primary sm:inline-flex"
              >
                View all
                <span className="grid size-7 place-items-center rounded-full bg-foreground text-background transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <ArrowRightIcon weight="bold" className="size-3" />
                </span>
              </Link>
            </div>
            <ul className="-mx-4 mt-10 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden">
              {p.related.slice(0, 8).map((r) => (
                <li key={r.id} className="w-[62vw] shrink-0 snap-start sm:w-[16rem] lg:w-auto">
                  <ProductCard product={r} sizes="(min-width: 1024px) 22vw, 62vw" />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd(p, slug)) }} />
    </>
  );
}

function ProductFallback() {
  return (
    <section className="mx-auto max-w-[1400px] px-4 pt-28 pb-16 sm:px-6 md:pt-32 lg:px-10">
      <div className="h-4 w-56 animate-pulse rounded bg-surface-2" />
      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="aspect-square animate-pulse rounded-[var(--radius-tile)] bg-surface-2 lg:col-span-7" />
        <div className="space-y-4 lg:col-span-5">
          <div className="h-12 w-4/5 animate-pulse rounded-lg bg-surface-2" />
          <div className="h-40 animate-pulse rounded-[var(--radius-tile)] bg-surface-2" />
        </div>
      </div>
    </section>
  );
}

export default function ProductPage({ params }: Props) {
  return (
    <Suspense fallback={<ProductFallback />}>
      <ProductView params={params} />
    </Suspense>
  );
}
