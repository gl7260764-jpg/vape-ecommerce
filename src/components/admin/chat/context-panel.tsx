import Link from "next/link";
import { ArrowRightIcon, EnvelopeSimpleIcon, PhoneIcon } from "@phosphor-icons/react/dist/ssr";
import { StatusPill } from "@/components/admin/ui/primitives";
import { formatDate } from "@/lib/admin/format";
import { formatPrice } from "@/lib/catalog";
import type { ContextOrder } from "@/lib/chat/inbox";
import type { ConversationDTO } from "@/lib/chat/types";
import { formatAuPhone, orderNumber, paymentLabel } from "@/lib/checkout";
import { CUSTOMER_STATUS } from "@/lib/customer-orders";

/** Beside a conversation: who this is, how to reach them, what they've ordered and how they found the store. */
export function ContextPanel({
  conversation,
  context,
}: {
  conversation: ConversationDTO;
  context: { orders: ContextOrder[]; visitorId: string | null; phone: string | null };
}) {
  const spent = context.orders.filter((o) => o.status !== "cancelled").reduce((sum, o) => sum + o.totalCents, 0);
  return (
    <div className="flex flex-col gap-6 p-5">
      <div className="pr-8">
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">Customer</p>
        <p className="mt-2 text-lg font-medium break-words">{conversation.customerName}</p>
        {conversation.tag && (
          <p className="mt-2 rounded-xl bg-primary/10 px-3 py-2 text-xs leading-relaxed text-foreground/80">
            <span className="font-semibold text-primary-ink">{conversation.tag}.</span> Signed in by typing this email. This device hasn&apos;t placed an order, so it
            isn&apos;t proven to be them.
          </p>
        )}
        <a href={`mailto:${conversation.customerEmail}`} className="mt-2 flex items-center gap-2 text-sm break-all text-muted-foreground hover:text-foreground">
          <EnvelopeSimpleIcon className="size-4 shrink-0" aria-hidden />
          {conversation.customerEmail}
        </a>
        {context.phone && (
          <a href={`tel:${context.phone}`} className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <PhoneIcon className="size-4 shrink-0" aria-hidden />
            {formatAuPhone(context.phone)}
          </a>
        )}
      </div>

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">Orders</h3>
          {context.orders.length > 0 && <p className="text-xs text-muted-foreground">{formatPrice(spent / 100)} in total</p>}
        </div>
        {context.orders.length ? (
          <ul className="mt-3 divide-y divide-border rounded-2xl border border-border">
            {context.orders.map((o) => {
              const status = CUSTOMER_STATUS[o.status as keyof typeof CUSTOMER_STATUS];
              return (
                <li key={o.id} className="flex flex-col gap-1.5 px-3.5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/admin/orders/${o.id}`} className="font-mono text-sm font-medium hover:text-primary-ink hover:underline">
                      {orderNumber(o.number)}
                    </Link>
                    <StatusPill label={status?.label ?? o.status} tone={status?.tone ?? "neutral"} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(new Date(o.createdAt))} · {paymentLabel(o.paymentMethod)} · <span className="font-mono text-foreground">{formatPrice(o.totalCents / 100)}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No orders found for this email.</p>
        )}
      </section>

      {context.visitorId && (
        <Link
          href={`/admin/analytics/visitors/${context.visitorId}`}
          className="group flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3 text-sm font-medium transition-colors hover:border-foreground/30"
        >
          How they found the store
          <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}
