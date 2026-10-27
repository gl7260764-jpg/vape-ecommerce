import type { Metadata } from "next";
import { ChatsCircleIcon, EnvelopeSimpleIcon, PhoneIcon } from "@phosphor-icons/react/dist/ssr";
import { ContactChatButton } from "@/components/store/contact-chat-button";
import { EnquiryForm } from "@/components/store/enquiry-form";
import { ListingHero } from "@/components/store/listing-hero";
import { pageMetadata } from "@/lib/seo";
import { CONTACT_EMAIL, CONTACT_PHONE, CONTACT_PHONE_DISPLAY } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Contact us",
  description: `Questions about an order, a product or a bulk buy? Email ${CONTACT_EMAIL}, call ${CONTACT_PHONE_DISPLAY} or chat with us.`,
  path: "/contact",
});

const CARD = "flex flex-col rounded-[var(--radius-tile)] border border-border bg-surface p-6 sm:p-7";
const ICON = "grid size-11 place-items-center rounded-full bg-primary/15 text-primary-ink";
const ACTION =
  "mt-6 inline-flex h-11 w-fit items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98]";

export default function ContactPage() {
  return (
    <>
      <ListingHero crumbs={[{ label: "Contact" }]} title="Contact us" tagline="Questions about an order, a product or a bulk buy? Get in touch the way that suits you." />
      <section className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 md:py-20 lg:px-10">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-5">
          <div className={CARD}>
            <span className={ICON}>
              <EnvelopeSimpleIcon className="size-5" aria-hidden />
            </span>
            <h2 className="mt-5 text-lg font-semibold">Email</h2>
            <p className="mt-1 text-sm break-all text-muted-foreground">{CONTACT_EMAIL}</p>
            <a href={`mailto:${CONTACT_EMAIL}`} className={ACTION}>
              <EnvelopeSimpleIcon className="size-4" aria-hidden />
              Send an email
            </a>
          </div>
          <div className={CARD}>
            <span className={ICON}>
              <PhoneIcon className="size-5" aria-hidden />
            </span>
            <h2 className="mt-5 text-lg font-semibold">Phone</h2>
            <p className="mt-1 text-sm text-muted-foreground">{CONTACT_PHONE_DISPLAY}</p>
            <a href={`tel:${CONTACT_PHONE}`} className={ACTION}>
              <PhoneIcon className="size-4" aria-hidden />
              Call us
            </a>
          </div>
          <div className={CARD}>
            <span className={ICON}>
              <ChatsCircleIcon className="size-5" aria-hidden />
            </span>
            <h2 className="mt-5 text-lg font-semibold">Live chat</h2>
            <p className="mt-1 text-sm text-muted-foreground">Message the team right here. Our replies come back to this device.</p>
            <ContactChatButton className={ACTION} />
          </div>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 className="font-display text-3xl leading-[0.95] font-extrabold tracking-[-0.03em] uppercase">Send us a message</h2>
            <p className="mt-4 max-w-[38ch] text-muted-foreground">
              We&apos;ll reply by email. About an order? Include your order number (it starts with BV-) so we can find it quickly.
            </p>
          </div>
          <div className="lg:col-span-8">
            <EnquiryForm />
          </div>
        </div>
      </section>
    </>
  );
}
