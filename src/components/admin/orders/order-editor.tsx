"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChatsCircleIcon, FileTextIcon, MagnifyingGlassIcon, PaperPlaneRightIcon, PlusIcon, TrashIcon, WarningIcon } from "@phosphor-icons/react";
import { findOrderProducts, saveOrder, sendOrderInvoice, setOrderStatus } from "@/app/actions/admin/orders";
import { BUTTON, StatusPill } from "@/components/admin/ui/primitives";
import { CONTROL, Field, Select } from "@/components/admin/ui/form";
import { orderStatusPill } from "@/lib/admin/order-status";
import type { OrderProductOption } from "@/lib/admin/queries/orders";
import { ORDER_STATUSES } from "@/lib/admin/schemas/order";
import { formatPrice } from "@/lib/catalog";
import { DISCOUNT_LABEL, discountCents } from "@/lib/discount";
import { AU_STATES, orderNumber, PAYMENT_METHODS } from "@/lib/checkout";
import type { OrderEditInput } from "@/lib/orders/edit";
import type { OrderStatusValue } from "@/lib/invoices/types";
import { cn } from "@/lib/utils";

export type EditorOrder = {
  id: string;
  number: number;
  status: OrderStatusValue;
  placedAt: string;
  paymentMethod: "bank_transfer" | "payid";
  details: OrderEditInput["details"];
  shippingCode: string;
  shippingName: string;
  shippingCents: number;
  /** Newsletter discount percent the order earned (0 when none); it applies to the edited items too. */
  discountPercent: number;
  discountLabel: string | null;
  items: { id: string; productId: string | null; name: string; quantity: number; unitPriceCents: number; image: string | null }[];
  conversationId: string | null;
  unsentChanges: boolean;
  latestInvoiceVersion: number | null;
};

type Line = { key: string; id?: string; productId: string | null; name: string; quantity: string; price: string; image: string | null };

const money = (cents: number) => formatPrice(cents / 100);
const toCents = (price: string) => Math.round(Number(price) * 100);
const lineCents = (l: Line) => {
  const q = Number(l.quantity);
  const c = toCents(l.price);
  return Number.isFinite(q) && Number.isFinite(c) ? q * c : 0;
};

function ProductSearch({ onPick, onClose }: { onPick: (p: OrderProductOption) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<OrderProductOption[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <div className="mt-3 rounded-2xl border border-border bg-background/60 p-3">
      <div className="relative">
        <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          autoFocus
          value={q}
          aria-label="Search products"
          placeholder="Search products by name"
          onKeyDown={(e) => e.key === "Escape" && onClose()}
          onChange={(e) => {
            const value = e.target.value;
            setQ(value);
            clearTimeout(timer.current);
            timer.current = setTimeout(async () => {
              setSearching(true);
              const r = await findOrderProducts(value).catch(() => null);
              setSearching(false);
              setResults(r?.ok ? r.data : []);
            }, 300);
          }}
          className={cn(CONTROL, "pl-10")}
        />
      </div>
      <ul className="mt-2 max-h-72 overflow-y-auto">
        {results.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              aria-label={`Add ${p.name}`}
              onClick={() => onPick(p)}
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm hover:bg-surface-2"
            >
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="shrink-0 font-mono text-muted-foreground">{money(p.priceCents)}</span>
            </button>
          </li>
        ))}
        {q.trim().length >= 2 && !searching && results.length === 0 && <li className="px-2.5 py-2 text-sm text-muted-foreground">No products match.</li>}
      </ul>
    </div>
  );
}

/** The order page: change anything, save it, send the corrected invoice, set the status. */
export function OrderEditor({
  order,
  shippingOptions,
  confirmation,
  timeline,
}: {
  order: EditorOrder;
  shippingOptions: { code: string; name: string; priceCents: number }[];
  confirmation: { label: string; tone: "warning" | "success" | "danger" | "neutral" };
  timeline: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [details, setDetails] = useState(order.details);
  const [shippingCode, setShippingCode] = useState(order.shippingCode);
  const [paymentMethod, setPaymentMethod] = useState(order.paymentMethod);
  const [lines, setLines] = useState<Line[]>(() =>
    order.items.map((i) => ({ key: i.id, id: i.id, productId: i.productId, name: i.name, quantity: String(i.quantity), price: (i.unitPriceCents / 100).toFixed(2), image: i.image }))
  );
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);

  const shippingCents = shippingCode === order.shippingCode ? order.shippingCents : (shippingOptions.find((s) => s.code === shippingCode)?.priceCents ?? 0);
  const subtotal = lines.reduce((sum, l) => sum + lineCents(l), 0);
  const discount = discountCents(subtotal, order.discountPercent);
  const total = subtotal - discount + shippingCents;
  const paidOrLater = order.status !== "pending_payment" && order.status !== "cancelled";
  const pill = orderStatusPill(order.status);
  const options = shippingOptions.some((s) => s.code === order.shippingCode)
    ? shippingOptions
    : [{ code: order.shippingCode, name: order.shippingName, priceCents: order.shippingCents }, ...shippingOptions];

  const touch = () => setDirty(true);
  const setDetail = (key: keyof EditorOrder["details"], value: string) => {
    setDetails((d) => ({ ...d, [key]: value }));
    touch();
  };
  const setLine = (key: string, change: Partial<Line>) => {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...change } : l)));
    touch();
  };

  const input = (): OrderEditInput => ({
    details,
    shippingCode,
    paymentMethod,
    items: lines.map((l) => ({ id: l.id, productId: l.productId, name: l.name, quantity: Number(l.quantity), unitPriceCents: toCents(l.price) })),
  });

  const save = async () => {
    const result = await saveOrder(order.id, input());
    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      toast.error(result.error);
      return false;
    }
    setErrors({});
    setDirty(false);
    return true;
  };

  const onSave = () =>
    startTransition(async () => {
      if (await save()) {
        toast.success("Changes saved");
        router.refresh();
      }
    });

  const onSend = () =>
    startTransition(async () => {
      if (dirty && !(await save())) return;
      const result = await sendOrderInvoice(order.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.data.posted ? `${result.data.number} sent to the chat` : `${result.data.number} issued. The customer sees it on their order page.`);
      router.refresh();
    });

  const onStatus = (status: string) =>
    startTransition(async () => {
      const result = await setOrderStatus(order.id, status);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Status changed to ${orderStatusPill(status).label}`);
      router.refresh();
    });

  const err = (key: string) => errors[key];

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Link href="/admin/orders" className="text-xs text-muted-foreground hover:text-foreground">
            Orders
          </Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 font-mono text-2xl font-bold tracking-tight md:text-3xl">
            {orderNumber(order.number)}
            <StatusPill label={pill.label} tone={pill.tone} className="font-sans" />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Placed {order.placedAt} · {details.fullName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {order.conversationId && (
            <Link href={`/admin/chats/${order.conversationId}`} className={BUTTON.secondary}>
              <ChatsCircleIcon className="size-4" aria-hidden />
              Open chat
            </Link>
          )}
          <button type="button" onClick={onSave} disabled={pending || !dirty} className={BUTTON.secondary}>
            Save changes
          </button>
          <button type="button" onClick={onSend} disabled={pending} className={BUTTON.primary}>
            <PaperPlaneRightIcon weight="fill" className="size-4" aria-hidden />
            {order.conversationId ? "Send invoice to chat" : "Issue invoice"}
          </button>
        </div>
      </div>

      {(paidOrLater || (order.unsentChanges && !dirty) || dirty) && (
        <div className="mt-5 flex flex-col gap-2">
          {paidOrLater && (
            <p className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
              <WarningIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              This order is {pill.label.toLowerCase()}. Changing items changes the total; settle any difference with the customer in the chat.
            </p>
          )}
          {dirty ? (
            <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-muted-foreground">You have unsaved changes. Save them, or send the invoice to save and send at once.</p>
          ) : (
            order.unsentChanges && (
              <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-muted-foreground">
                Saved changes haven&apos;t been sent to the customer yet. Send the invoice when you&apos;re ready.
              </p>
            )
          )}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="rounded-[var(--radius-tile)] border border-border bg-surface p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-medium">Items</h2>
              <button type="button" onClick={() => setAdding((a) => !a)} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-ink hover:underline">
                <PlusIcon className="size-4" aria-hidden />
                Add product
              </button>
            </div>
            {adding && (
              <ProductSearch
                onClose={() => setAdding(false)}
                onPick={(p) => {
                  setLines((ls) => [...ls, { key: `new-${p.id}-${ls.length}`, productId: p.id, name: p.name, quantity: "1", price: (p.priceCents / 100).toFixed(2), image: p.image }]);
                  setAdding(false);
                  touch();
                }}
              />
            )}
            {err("items") && <p className="mt-2 text-sm text-destructive">{err("items")}</p>}
            <ul className="mt-3 divide-y divide-border">
              {lines.map((l, i) => (
                <li key={l.key} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 py-3 sm:grid-cols-[minmax(0,1fr)_5rem_7rem_6rem_2rem] sm:items-center">
                  <div className="min-w-0">
                    <input
                      value={l.name}
                      aria-label="Item name"
                      onChange={(e) => setLine(l.key, { name: e.target.value })}
                      className={cn(CONTROL, "h-9")}
                      aria-invalid={Boolean(err(`items.${i}.name`))}
                    />
                    {(err(`items.${i}.name`) || err(`items.${i}.productId`)) && <p className="mt-1 text-xs text-destructive">{err(`items.${i}.name`) ?? err(`items.${i}.productId`)}</p>}
                  </div>
                  <div className="flex items-center gap-2 sm:contents">
                    <div>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={l.quantity}
                        aria-label={`Quantity for ${l.name}`}
                        onChange={(e) => setLine(l.key, { quantity: e.target.value })}
                        className={cn(CONTROL, "h-9 w-20 font-mono")}
                        aria-invalid={Boolean(err(`items.${i}.quantity`))}
                      />
                      {err(`items.${i}.quantity`) && <p className="mt-1 text-xs text-destructive">{err(`items.${i}.quantity`)}</p>}
                    </div>
                    <div>
                      <div className="relative">
                        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                        <input
                          inputMode="decimal"
                          value={l.price}
                          aria-label={`Unit price for ${l.name}`}
                          onChange={(e) => setLine(l.key, { price: e.target.value })}
                          className={cn(CONTROL, "h-9 w-28 pl-6 font-mono")}
                          aria-invalid={Boolean(err(`items.${i}.unitPriceCents`))}
                        />
                      </div>
                      {err(`items.${i}.unitPriceCents`) && <p className="mt-1 text-xs text-destructive">{err(`items.${i}.unitPriceCents`)}</p>}
                    </div>
                  </div>
                  <span className="self-center text-right font-mono tabular-nums">{money(lineCents(l))}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${l.name}`}
                    onClick={() => {
                      setLines((ls) => ls.filter((x) => x.key !== l.key));
                      touch();
                    }}
                    className="col-start-2 row-start-1 grid size-8 place-items-center justify-self-end rounded-full text-muted-foreground hover:bg-surface-2 hover:text-destructive sm:col-auto sm:row-auto"
                  >
                    <TrashIcon className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <dl className="mt-3 flex flex-wrap justify-end gap-x-6 gap-y-1 border-t border-border pt-3 text-sm">
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-mono">{money(subtotal)}</dd>
              </div>
              {discount > 0 && (
                <div className="flex gap-2 text-primary-ink">
                  <dt>{order.discountLabel ?? DISCOUNT_LABEL(order.discountPercent)}</dt>
                  <dd className="font-mono">-{money(discount)}</dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd className="font-mono">{money(shippingCents)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium">Total</dt>
                <dd>
                  <output aria-label="Order total" className="font-mono font-semibold text-primary-ink">
                    {money(total)}
                  </output>
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-[var(--radius-tile)] border border-border bg-surface p-4 sm:p-5">
            <h2 className="font-medium">Customer and delivery</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="fullName" label="Full name" error={err("fullName")}>
                <input id="fullName" value={details.fullName} onChange={(e) => setDetail("fullName", e.target.value)} className={CONTROL} aria-invalid={Boolean(err("fullName"))} />
              </Field>
              <Field id="phone" label="Phone" error={err("phone")}>
                <input id="phone" type="tel" value={details.phone} onChange={(e) => setDetail("phone", e.target.value)} className={CONTROL} aria-invalid={Boolean(err("phone"))} />
              </Field>
              <Field id="email" label="Email" error={err("email")} className="sm:col-span-2">
                <input id="email" type="email" value={details.email} onChange={(e) => setDetail("email", e.target.value)} className={CONTROL} aria-invalid={Boolean(err("email"))} />
              </Field>
              <Field id="addressLine1" label="Address" error={err("addressLine1")} className="sm:col-span-2">
                <input id="addressLine1" value={details.addressLine1} onChange={(e) => setDetail("addressLine1", e.target.value)} className={CONTROL} aria-invalid={Boolean(err("addressLine1"))} />
              </Field>
              <Field id="addressLine2" label="Address line 2" optional error={err("addressLine2")} className="sm:col-span-2">
                <input id="addressLine2" value={details.addressLine2} onChange={(e) => setDetail("addressLine2", e.target.value)} className={CONTROL} />
              </Field>
              <Field id="suburb" label="Suburb" error={err("suburb")}>
                <input id="suburb" value={details.suburb} onChange={(e) => setDetail("suburb", e.target.value)} className={CONTROL} aria-invalid={Boolean(err("suburb"))} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field id="state" label="State" error={err("state")}>
                  <Select id="state" value={details.state} onChange={(e) => setDetail("state", e.target.value)}>
                    {AU_STATES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.code}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field id="postcode" label="Postcode" error={err("postcode")}>
                  <input id="postcode" inputMode="numeric" value={details.postcode} onChange={(e) => setDetail("postcode", e.target.value)} className={CONTROL} aria-invalid={Boolean(err("postcode"))} />
                </Field>
              </div>
              <Field id="shipping" label="Shipping" error={err("shipping")}>
                <Select
                  id="shipping"
                  value={shippingCode}
                  onChange={(e) => {
                    setShippingCode(e.target.value);
                    touch();
                  }}
                >
                  {options.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name} · {money(s.code === order.shippingCode ? order.shippingCents : s.priceCents)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="payment" label="Payment method" error={err("payment")}>
                <Select
                  id="payment"
                  value={paymentMethod}
                  onChange={(e) => {
                    setPaymentMethod(e.target.value as EditorOrder["paymentMethod"]);
                    touch();
                  }}
                >
                  {PAYMENT_METHODS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <section className="rounded-[var(--radius-tile)] border border-border bg-surface p-4 sm:p-5">
            <h2 className="font-medium">Status</h2>
            <div className="mt-3">
              <Select aria-label="Status" value={order.status} disabled={pending} onChange={(e) => onStatus(e.target.value)}>
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {orderStatusPill(s).label}
                  </option>
                ))}
              </Select>
            </div>
          </section>
          <section className="rounded-[var(--radius-tile)] border border-border bg-surface p-4 sm:p-5">
            <h2 className="font-medium">Invoice</h2>
            <p className="mt-2">
              <StatusPill label={confirmation.label} tone={confirmation.tone} />
            </p>
            {timeline}
            {order.latestInvoiceVersion !== null && (
              <a
                href={`/admin/invoice/${order.id}/${order.latestInvoiceVersion}`}
                target="_blank"
                rel="noopener"
                className={cn(BUTTON.secondary, "mt-4 w-full")}
              >
                <FileTextIcon className="size-4" aria-hidden />
                View or print invoice
              </a>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
