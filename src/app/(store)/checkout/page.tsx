import type { Metadata } from "next";
import { LockSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { getShippingMethods } from "@/lib/checkout-queries";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const shippingMethods = await getShippingMethods();

  return (
    <section className="mx-auto max-w-[1400px] px-4 pt-28 pb-20 sm:px-6 md:pt-32 lg:px-10">
      <Breadcrumbs items={[{ label: "Shop", href: "/shop" }, { label: "Checkout" }]} />
      <div className="mt-8 mb-10 flex flex-wrap items-end justify-between gap-4 md:mb-12">
        <h1 className="font-display text-[clamp(2.25rem,6vw,4rem)] leading-[0.92] font-extrabold tracking-[-0.03em] uppercase">Checkout</h1>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LockSimpleIcon weight="fill" className="size-4 text-primary-ink" aria-hidden />
          Your details stay private
        </p>
      </div>
      <CheckoutForm shippingMethods={shippingMethods} />
    </section>
  );
}
