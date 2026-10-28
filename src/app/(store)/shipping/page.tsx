import type { Metadata } from "next";
import Link from "next/link";
import { TruckIcon } from "@phosphor-icons/react/dist/ssr";
import { ListingHero } from "@/components/store/listing-hero";
import { formatPrice } from "@/lib/catalog";
import { getShippingMethods } from "@/lib/checkout-queries";
import { pageMetadata } from "@/lib/seo";

// /shipping is the old store's address, already linked from the footer. The options and prices are the ones
// checkout charges (Admin > Settings > Shipping), so the page changes when they do.
export const metadata: Metadata = pageMetadata({
  title: "Shipping",
  description: "Delivery options and prices for orders across Australia, with tracking on every parcel to every state and territory.",
  path: "/shipping",
});

const CARD = "flex flex-col rounded-[var(--radius-tile)] border border-border bg-surface p-6 sm:p-7";

export default async function ShippingPage() {
  const methods = await getShippingMethods();
  return (
    <>
      <ListingHero crumbs={[{ label: "Shipping" }]} title="Shipping" tagline="Tracked delivery to every state and territory, priced at checkout by the option you pick." />

      <section className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 md:py-20 lg:px-10">
        <h2 className="font-display text-3xl leading-[0.95] font-extrabold tracking-[-0.03em] uppercase">Delivery options</h2>
        <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-5">
          {methods.map((m) => (
            <li key={m.code} className={CARD}>
              <span className="grid size-11 place-items-center rounded-full bg-primary/15 text-primary-ink">
                <TruckIcon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-5 flex items-baseline justify-between gap-4 text-lg font-semibold">
                {m.name}
                <span className="font-mono text-base">{formatPrice(m.price)}</span>
              </h3>
              {m.description && <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>}
            </li>
          ))}
        </ul>

        <div className="mt-14 max-w-[62ch] space-y-5 text-lg leading-relaxed text-foreground/85">
          <p>The delivery price is added once per order, whatever its size, so a bulk box ships for the same price as a single bar.</p>
          <p>
            Questions about a delivery? <Link href="/contact" className="font-medium text-primary-ink underline-offset-4 hover:underline">Contact us</Link> with
            your order number (it starts with BV-) and we&apos;ll look it up.
          </p>
          <p className="text-base text-muted-foreground">We only sell and deliver to adults aged 18 and over.</p>
        </div>
      </section>
    </>
  );
}
