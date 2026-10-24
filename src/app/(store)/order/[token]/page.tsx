import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChatsCircleIcon, CheckCircleIcon, FileTextIcon, PackageIcon, ReceiptIcon } from "@phosphor-icons/react/dist/ssr";
import { OpenChatOnLoad } from "@/components/chat/customer/open-chat-on-load";
import { prisma } from "@/lib/db";
import { DISCOUNT_LABEL } from "@/lib/discount";
import type { InvoiceSnapshot } from "@/lib/invoices/types";
import { formatPrice, mediaUrl } from "@/lib/catalog";
import { AU_STATES, formatAuPhone, orderNumber, paymentLabel, paymentPhrase } from "@/lib/checkout";

type Props = PageProps<"/order/[token]">;

export const metadata: Metadata = {
  title: "Order received",
  robots: { index: false, follow: false },
};

/** Looked up fresh on every visit; the token in the URL is the customer's private link to their order. */
async function getOrder(token: string) {
  await connection();
  if (!/^[\w-]{20,40}$/.test(token)) return null;
  return prisma.order.findUnique({
    where: { publicToken: token },
    include: {
      invoices: { orderBy: { version: "desc" }, take: 1, select: { snapshot: true } },
      items: {
        orderBy: { id: "asc" },
        include: { product: { select: { images: { orderBy: { position: "asc" }, take: 1, select: { hasBackground: true } } } } },
      },
    },
  });
}

const money = (cents: number) => formatPrice(cents / 100);

type LoadedOrder = NonNullable<Awaited<ReturnType<typeof getOrder>>>;

/**
 * What the customer sees is what was last sent to them: once the order has an invoice, its details
 * come from that invoice, so edits the team saved but hasn't sent stay private. Status stays live.
 */
function asLastSent(order: LoadedOrder) {
  const sent = order.invoices[0]?.snapshot as InvoiceSnapshot | undefined;
  if (!sent) return order;
  return {
    ...order,
    fullName: sent.billedTo.name,
    email: sent.billedTo.email,
    phone: sent.billedTo.phone,
    addressLine1: sent.shipTo.addressLine1,
    addressLine2: sent.shipTo.addressLine2,
    suburb: sent.shipTo.suburb,
    state: sent.shipTo.state as LoadedOrder["state"],
    postcode: sent.shipTo.postcode,
    shippingName: sent.shipTo.shippingName,
    paymentMethod: sent.paymentMethod,
    subtotalCents: sent.subtotalCents,
    discountPercent: sent.discountPercent ?? 0,
    discountCents: sent.discountCents ?? 0,
    discountLabel: sent.discountLabel ?? null,
    shippingCents: sent.shippingCents,
    totalCents: sent.totalCents,
    items: sent.items.map((i, n) => ({
      id: `sent-${n}`,
      name: i.name,
      slug: "",
      imageKey: i.imageKey,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      lineTotalCents: i.amountCents,
      product: null,
    })),
  };
}

async function OrderView({ params }: Pick<Props, "params">) {
  const { token } = await params;
  const loaded = await getOrder(token);
  if (!loaded) notFound();
  const order = asLastSent(loaded);
  const hasInvoice = loaded.invoices.length > 0;

  const method = paymentLabel(order.paymentMethod);
  const phrase = paymentPhrase(order.paymentMethod);
  const stateName = AU_STATES.find((s) => s.code === order.state)?.name ?? order.state;
  const placedAt = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Australia/Sydney" }).format(
    order.createdAt
  );
  const awaitingPayment = order.status === "pending_payment";

  const steps = [
    {
      icon: FileTextIcon,
      title: "Check your invoice",
      body: "Your invoice is in the chat. Tap \"Yes, all correct\" if your items and delivery details are right, or tell us what to change.",
    },
    {
      icon: ChatsCircleIcon,
      title: "Payment details",
      body: `Our team sends your ${phrase} details by email or live chat, usually within 5 minutes.`,
    },
    {
      icon: ReceiptIcon,
      title: "Pay with your order number",
      body: `Use ${orderNumber(order.number)} as the payment reference so we can match it straight away.`,
    },
    {
      icon: PackageIcon,
      title: "Dispatch",
      body: `Once payment lands, your order ships by ${order.shippingName.toLowerCase()} with tracking.`,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
      {awaitingPayment && <OpenChatOnLoad orderId={order.id} />}
      <div className="flex flex-col gap-6 lg:col-span-7">
        <div className="relative isolate overflow-hidden rounded-[var(--radius-tile)] border border-primary/40 bg-surface p-6 md:p-9">
          <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 -z-10 size-80 rounded-full bg-primary/15 blur-[100px]" />
          <CheckCircleIcon weight="fill" className="size-12 text-primary-ink" aria-hidden />
          <p className="mt-6 font-mono text-sm text-muted-foreground">
            Order {orderNumber(order.number)} · {placedAt}
          </p>
          <h1 className="mt-2 font-display text-[clamp(2rem,5vw,3.5rem)] leading-[0.95] font-extrabold tracking-[-0.03em] uppercase">
            Thanks, {order.fullName.split(" ")[0]}. Order received.
          </h1>
          {awaitingPayment ? (
            <p className="mt-5 max-w-[56ch] text-lg leading-relaxed text-muted-foreground">
              We&apos;ll contact you within <span className="font-medium text-foreground">5 minutes</span> by email or live chat with the{" "}
              {phrase} payment details. Nothing has been charged yet.
            </p>
          ) : (
            <p className="mt-5 max-w-[56ch] text-lg leading-relaxed text-muted-foreground">
              Status: <span className="font-medium text-foreground">{order.status.replace("_", " ")}</span>. Message us any time if you have a
              question about this order.
            </p>
          )}
          <p className="mt-6 inline-block rounded-2xl bg-surface-2 px-4 py-2.5 text-sm leading-relaxed">
            We&apos;ll reach you at <span className="font-medium break-all">{order.email}</span>
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Your account is set up with this email. This order is saved in{" "}
            <Link href="/account" className="font-medium text-primary-ink hover:underline">
              your account
            </Link>{" "}
            on this device. On another device, just enter your email there.
          </p>
        </div>

        {awaitingPayment && (
          <section className="rounded-[var(--radius-tile)] border border-border bg-surface p-6 md:p-8">
            <h2 className="font-display text-lg font-bold uppercase md:text-xl">What happens next</h2>
            <ol className="mt-6 grid gap-5">
              {steps.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/12 text-primary-ink">
                    <Icon weight="fill" className="size-5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-medium">{title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="grid gap-6 rounded-[var(--radius-tile)] border border-border bg-surface p-6 sm:grid-cols-2 md:p-8">
          <div>
            <h2 className="text-sm font-medium text-muted-foreground">Delivery address</h2>
            <address className="mt-2 leading-relaxed not-italic">
              {order.fullName}
              <br />
              {order.addressLine1}
              {order.addressLine2 && (
                <>
                  <br />
                  {order.addressLine2}
                </>
              )}
              <br />
              {order.suburb} {order.state} {order.postcode}
              <br />
              <span className="sr-only">{stateName}, </span>Australia
            </address>
          </div>
          <div>
            <h2 className="text-sm font-medium text-muted-foreground">Contact</h2>
            <p className="mt-2 leading-relaxed break-all">
              {order.email}
              <br />
              {formatAuPhone(order.phone)}
            </p>
            <h2 className="mt-5 text-sm font-medium text-muted-foreground">Payment</h2>
            <p className="mt-2">{method}</p>
          </div>
          {order.notes && (
            <div className="sm:col-span-2">
              <h2 className="text-sm font-medium text-muted-foreground">Delivery notes</h2>
              <p className="mt-2 leading-relaxed whitespace-pre-line">{order.notes}</p>
            </div>
          )}
        </section>
      </div>

      <aside className="lg:col-span-5">
        <div className="rounded-[var(--radius-tile)] border border-border bg-surface p-6 md:p-7 lg:sticky lg:top-28">
          <h2 className="font-display text-lg font-bold uppercase md:text-xl">Your order</h2>
          <ul className="mt-6 divide-y divide-border">
            {order.items.map((item) => {
              const cover = item.product?.images[0]?.hasBackground;
              const name = (
                <span className="line-clamp-2 text-sm font-medium">{item.name}</span>
              );
              return (
                <li key={item.id} className="flex items-center gap-4 py-4 first:pt-0">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-tile">
                    {item.imageKey && (
                      <Image
                        src={mediaUrl(item.imageKey)}
                        alt=""
                        fill
                        sizes="64px"
                        className={cover ? "scale-[1.12] object-cover" : "object-contain p-1.5"}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {item.product ? (
                      <Link href={`/product/${item.slug}`} className="hover:text-primary-ink">
                        {name}
                      </Link>
                    ) : (
                      name
                    )}
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                      {item.quantity} × {money(item.unitPriceCents)}
                    </p>
                  </div>
                  <p className="font-mono text-sm">{money(item.lineTotalCents)}</p>
                </li>
              );
            })}
          </ul>
          <dl className="mt-6 space-y-3 border-t border-border pt-6 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="font-mono">{money(order.subtotalCents)}</dd>
            </div>
            {order.discountCents > 0 && (
              <div className="flex justify-between text-primary-ink">
                <dt>{order.discountLabel ?? DISCOUNT_LABEL(order.discountPercent)}</dt>
                <dd className="font-mono">-{money(order.discountCents)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{order.shippingName}</dt>
              <dd className="font-mono">{money(order.shippingCents)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-border pt-4">
              <dt className="font-medium">Total</dt>
              <dd className="font-mono text-2xl font-medium tracking-tight">{money(order.totalCents)}</dd>
            </div>
            <p className="text-xs text-muted-foreground">AUD, GST included.</p>
          </dl>
          {hasInvoice && (
            <Link
              href={`/invoice/${token}`}
              className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              View invoice
            </Link>
          )}
          <Link
            href="/shop"
            className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-full border border-border font-semibold transition-colors hover:border-foreground/30"
          >
            Continue shopping
          </Link>
        </div>
      </aside>
    </div>
  );
}

function OrderFallback() {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10" aria-label="Loading your order">
      <div className="space-y-6 lg:col-span-7">
        <div className="h-80 animate-pulse rounded-[var(--radius-tile)] bg-surface" />
        <div className="h-56 animate-pulse rounded-[var(--radius-tile)] bg-surface" />
      </div>
      <div className="h-96 animate-pulse rounded-[var(--radius-tile)] bg-surface lg:col-span-5" />
    </div>
  );
}

export default function OrderPage({ params }: Props) {
  return (
    <section className="mx-auto max-w-[1400px] px-4 pt-28 pb-20 sm:px-6 md:pt-32 lg:px-10">
      <Suspense fallback={<OrderFallback />}>
        <OrderView params={params} />
      </Suspense>
    </section>
  );
}
