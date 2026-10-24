import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, PackageIcon } from "@phosphor-icons/react/dist/ssr";
import { CUSTOMER_STATUS, type DeviceOrder } from "@/lib/customer-orders";
import { formatPrice } from "@/lib/catalog";
import { orderNumber, paymentLabel } from "@/lib/checkout";
import { cn } from "@/lib/utils";

// One order on the account page: in full when it was placed on this device, a summary otherwise.

const placed = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Sydney" });

const TONE = {
  warning: "bg-amber-500/14 text-amber-800 ring-amber-600/25 dark:text-amber-300 dark:ring-amber-400/25",
  info: "bg-sky-500/12 text-sky-700 ring-sky-600/20 dark:text-sky-300 dark:ring-sky-400/25",
  success: "bg-emerald-500/12 text-emerald-700 ring-emerald-600/20 dark:text-emerald-300 dark:ring-emerald-400/25",
  danger: "bg-rose-500/12 text-rose-700 ring-rose-600/20 dark:text-rose-300 dark:ring-rose-400/25",
};

export function OrderCard({ order }: { order: DeviceOrder }) {
  const status = CUSTOMER_STATUS[order.status];
  const units = order.items.reduce((n, i) => n + i.quantity, 0);
  return (
    <li className="rounded-[var(--radius-tile)] border border-border bg-surface p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-lg font-medium">{orderNumber(order.number)}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Placed {placed.format(order.createdAt)} · {paymentLabel(order.paymentMethod)}
          </p>
        </div>
        <span className={cn("inline-flex h-7 items-center rounded-full px-3 text-xs font-medium ring-1 ring-inset", TONE[status.tone])}>{status.label}</span>
      </div>

      <ul className="mt-5 flex flex-col gap-3">
        {order.items.slice(0, 3).map((item) => (
          <li key={item.id} className="flex items-center gap-3">
            <div className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-tile">
              {item.image ? (
                <Image src={item.image} alt="" fill sizes="48px" className="object-contain p-1" />
              ) : (
                <PackageIcon className="absolute inset-0 m-auto size-5 text-tile-foreground/40" aria-hidden />
              )}
            </div>
            <p className="min-w-0 flex-1 truncate text-sm">
              <span className="font-mono text-muted-foreground">{item.quantity} ×</span> {item.name}
            </p>
          </li>
        ))}
        {order.items.length > 3 && <li className="pl-15 text-sm text-muted-foreground">and {order.items.length - 3} more</li>}
      </ul>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
        <p className="text-sm text-muted-foreground">
          {units} {units === 1 ? "item" : "items"} · {order.shippingName} to {[order.suburb, order.state].filter(Boolean).join(" ")}
          <span className="ml-3 font-mono text-base font-medium text-foreground">{formatPrice(order.totalCents / 100)}</span>
        </p>
        {order.publicToken ? (
          <div className="flex flex-wrap gap-2">
            {order.hasInvoice && (
              <Link href={`/invoice/${order.publicToken}`} className="inline-flex h-10 items-center rounded-full border border-border px-4 text-sm font-medium transition-colors hover:border-foreground/30">
                View invoice
              </Link>
            )}
            <Link href={`/order/${order.publicToken}`} className="group inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium transition-colors hover:border-foreground/30">
              View order <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        ) : (
          <p className="max-w-[34ch] text-xs leading-relaxed text-muted-foreground">Full delivery details show on the device you ordered from.</p>
        )}
      </div>
    </li>
  );
}
