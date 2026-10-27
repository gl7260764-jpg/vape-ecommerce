import type { Metadata } from "next";
import Link from "next/link";
import { Perks } from "@/components/home/perks";
import { ListingHero } from "@/components/store/listing-hero";
import { pageMetadata } from "@/lib/seo";
import { CONTACT_EMAIL, CONTACT_PHONE, CONTACT_PHONE_DISPLAY, SITE_HOST, SITE_URL } from "@/lib/site";
import { getPublicBusinessDetails } from "@/lib/store-profile";

// /about-us is the old store's address, so links to it from before the move keep working.
export const metadata: Metadata = pageMetadata({
  title: "About us",
  description: `The online store at ${SITE_HOST} for genuine IGET, Alibarbar and HQD disposables, with bulk-buy pricing and tracked delivery Australia-wide. Adults 18+ only.`,
  path: "/about-us",
});

const BUTTON = "inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold transition-transform active:scale-[0.98]";

export default async function AboutPage() {
  // The ABN and address come from Admin > Settings > Business and only show once the owner fills them in.
  const { abn, address } = await getPublicBusinessDetails();
  const details = [
    { label: "Trading name", value: "Best Vape Shop Australia" },
    { label: "Website", value: SITE_HOST },
    ...(abn ? [{ label: "ABN", value: abn.replace(/^(\d{2})(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3 $4") }] : []),
    ...(address ? [{ label: "Address", value: address }] : []),
    { label: "Email", value: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
    { label: "Phone", value: CONTACT_PHONE_DISPLAY, href: `tel:${CONTACT_PHONE}` },
  ];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    url: `${SITE_URL}/about-us`,
    mainEntity: {
      "@type": "OnlineStore",
      name: "Best Vape Shop Australia",
      url: SITE_URL,
      email: CONTACT_EMAIL,
      telephone: CONTACT_PHONE,
      ...(abn ? { taxID: abn } : {}),
      ...(address ? { address } : {}),
    },
  };

  return (
    <>
      <ListingHero
        crumbs={[{ label: "About us" }]}
        title="About us"
        tagline="Genuine disposables from the brands you know, at bulk-buy prices, delivered to every state and territory."
      />

      <section className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 md:py-20 lg:px-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <h2 className="font-display text-3xl leading-[0.95] font-extrabold tracking-[-0.03em] uppercase lg:col-span-4">Who we are</h2>
          <div className="max-w-[62ch] space-y-5 text-lg leading-relaxed text-foreground/85 lg:col-span-8">
            <p>
              Best Vape Shop Australia is an online store at {SITE_HOST}. We stock the disposables Australians ask for most, from IGET, Alibarbar,
              HQD and more, from compact bars to high-puff rechargeables.
            </p>
            <p>
              Buying in bulk brings the price of every bar down, so you can pick your go-to flavour, stock up once and skip the weekly reorder. Every
              order ships tracked, to every state and territory.
            </p>
            <p>
              Questions about an order or a product? <Link href="/contact" className="font-medium text-primary-ink underline-offset-4 hover:underline">Get in touch</Link>{" "}
              and a real person on our team will reply.
            </p>
            <p className="text-base text-muted-foreground">We only sell to adults aged 18 and over.</p>
          </div>
        </div>
      </section>

      <Perks />

      <section className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 md:py-20 lg:px-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <h2 className="font-display text-3xl leading-[0.95] font-extrabold tracking-[-0.03em] uppercase lg:col-span-4">Business details</h2>
          <div className="lg:col-span-8">
            <dl className="divide-y divide-border rounded-[var(--radius-tile)] border border-border bg-surface">
              {details.map((d) => (
                <div key={d.label} className="grid grid-cols-1 gap-1 px-6 py-4 sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm text-muted-foreground">{d.label}</dt>
                  <dd className="break-words whitespace-pre-line sm:col-span-2">
                    {d.href ? (
                      <a href={d.href} className="hover:text-primary-ink">
                        {d.value}
                      </a>
                    ) : (
                      d.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/shop" className={`${BUTTON} bg-primary text-primary-foreground`}>
                Shop all products
              </Link>
              <Link href="/contact" className={`${BUTTON} border border-border hover:border-foreground/30`}>
                Contact us
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* "<" escaped so an address can't close the script tag. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
