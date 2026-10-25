"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { BankIcon, CaretDownIcon, CheckIcon, LightningIcon, LockSimpleIcon, ShoppingBagOpenIcon, TruckIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { placeOrder, quoteCart, savedDetails, type Quote } from "@/app/actions/checkout";
import {
  AU_STATES,
  formatAuPhone,
  normaliseAuPhone,
  PAYMENT_METHODS,
  paymentPhrase,
  validateCheckout,
  type CheckoutFormValues,
  type FieldErrors,
} from "@/lib/checkout";
import type { ShippingOption } from "@/lib/checkout-queries";
import { formatPrice } from "@/lib/catalog";
import { useCart } from "@/lib/cart-store";
import { useHydrated } from "@/hooks/use-hydrated";
import { track } from "@/lib/analytics/client";
import { cn } from "@/lib/utils";

type Values = CheckoutFormValues;

const INPUT =
  "h-12 w-full rounded-xl border bg-background/40 px-4 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-ring/40";

function Field({
  id,
  label,
  error,
  hint,
  optional,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional && <span className="font-normal text-muted-foreground"> (optional)</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-sm text-destructive">
          <WarningCircleIcon className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-tile)] border border-border bg-surface p-5 md:p-7">
      <h2 className="font-display text-lg font-bold uppercase md:text-xl">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** Selectable card used for shipping and payment choices. */
function Choice({
  name,
  value,
  checked,
  onChange,
  icon,
  title,
  detail,
  aside,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (v: string) => void;
  icon: React.ReactNode;
  title: string;
  detail?: string | null;
  aside?: string;
}) {
  return (
    <label
      className={cn(
        "relative flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 md:p-5",
        checked ? "border-primary bg-primary/[0.06]" : "border-border hover:border-foreground/30"
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} className="sr-only" />
      <span
        aria-hidden
        className={cn(
          "mt-0.5 grid size-10 shrink-0 place-items-center rounded-full transition-colors",
          checked ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted-foreground"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="font-medium">{title}</span>
          <span className="flex shrink-0 items-center gap-2.5">
            {aside && <span className="font-mono text-sm font-medium">{aside}</span>}
            <span
              aria-hidden
              className={cn(
                "grid size-5 place-items-center rounded-full transition-opacity",
                checked ? "bg-primary text-primary-foreground" : "opacity-0"
              )}
            >
              <CheckIcon weight="bold" className="size-3" />
            </span>
          </span>
        </span>
        {detail && <span className="mt-1 block text-sm text-muted-foreground">{detail}</span>}
      </span>
    </label>
  );
}

function Summary({
  quote,
  shipping,
  loading,
  onEditCart,
}: {
  quote: Quote | null;
  shipping: ShippingOption | undefined;
  loading: boolean;
  onEditCart: () => void;
}) {
  const subtotal = (quote?.subtotalCents ?? 0) / 100;
  const discount = (quote?.discount?.cents ?? 0) / 100;
  const total = subtotal - discount + (shipping?.price ?? 0);
  return (
    <div className="rounded-[var(--radius-tile)] border border-border bg-surface p-5 md:p-7">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold uppercase md:text-xl">Order summary</h2>
        <button type="button" onClick={onEditCart} className="text-sm font-medium text-primary-ink hover:underline">
          Edit cart
        </button>
      </div>

      {quote && quote.unavailable.length > 0 && (
        <p className="mt-5 flex gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <WarningCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {quote.unavailable.length === 1 ? "One item is" : `${quote.unavailable.length} items are`} no longer available and won&apos;t be ordered. Edit
          your cart to remove {quote.unavailable.length === 1 ? "it" : "them"}.
        </p>
      )}

      <ul className={cn("mt-6 divide-y divide-border transition-opacity", loading && "opacity-50")} aria-busy={loading}>
        {(quote?.items ?? []).map((item) => (
          <li key={item.id} className="flex items-center gap-4 py-4 first:pt-0">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-tile">
              {item.image && (
                <Image
                  src={item.image}
                  alt=""
                  fill
                  sizes="64px"
                  className={item.imageFit === "cover" ? "scale-[1.12] object-cover" : "object-contain p-1.5"}
                />
              )}
              <span className="absolute -top-0 -right-0 grid min-w-5 place-items-center rounded-bl-lg bg-tile-foreground px-1.5 font-mono text-[0.7rem] leading-5 text-tile">
                {item.quantity}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <Link href={`/product/${item.slug}`} className="line-clamp-2 text-sm font-medium hover:text-primary-ink">
                {item.name}
              </Link>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                {item.quantity} × {formatPrice(item.unitPriceCents / 100)}
              </p>
            </div>
            <p className="font-mono text-sm">{formatPrice(item.lineTotalCents / 100)}</p>
          </li>
        ))}
      </ul>

      <dl className="mt-6 space-y-3 border-t border-border pt-6 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="font-mono">{formatPrice(subtotal)}</dd>
        </div>
        {quote?.discount && (
          <div className="flex justify-between text-primary-ink">
            <dt>{quote.discount.label}</dt>
            <dd className="font-mono">-{formatPrice(discount)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{shipping?.name ?? "Shipping"}</dt>
          <dd className="font-mono">{shipping ? formatPrice(shipping.price) : "-"}</dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-border pt-4">
          <dt className="font-medium">Total</dt>
          <dd className="font-mono text-2xl font-medium tracking-tight">{formatPrice(total)}</dd>
        </div>
        <p className="text-xs text-muted-foreground">Prices in AUD and include GST.</p>
      </dl>
    </div>
  );
}

export function CheckoutForm({ shippingMethods }: { shippingMethods: ShippingOption[] }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const lines = useCart((s) => s.lines);
  const clearCart = useCart((s) => s.clear);
  const openCart = useCart((s) => s.setOpen);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [placed, setPlaced] = useState(false);
  const honeypot = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [values, setValues] = useState<Values>({
    fullName: "",
    email: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    suburb: "",
    state: "",
    postcode: "",
    shipping: shippingMethods[0]?.code ?? "",
    payment: "bank_transfer",
    notes: "",
  });

  // A returning customer: their details from the last order placed on this device (just the email on a
  // device that only typed it). Only fills an untouched form.
  const [filledFromOrder, setFilledFromOrder] = useState(false);
  useEffect(() => {
    let cancelled = false;
    savedDetails()
      .then((saved) => {
        if (cancelled || !saved) return;
        setValues((v) => {
          const untouched = !v.fullName && !v.email && !v.phone && !v.addressLine1 && !v.addressLine2 && !v.suburb && !v.state && !v.postcode;
          if (!untouched) return v;
          const { fromOrder, ...details } = saved;
          if (fromOrder) setFilledFromOrder(true);
          return { ...v, ...details };
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const clearSaved = () => {
    setValues((v) => ({ ...v, fullName: "", email: "", phone: "", addressLine1: "", addressLine2: "", suburb: "", state: "", postcode: "" }));
    setFilledFromOrder(false);
    setErrors({});
  };

  const cartKey = useMemo(() => lines.map((l) => `${l.product.id}:${l.quantity}`).join(","), [lines]);
  const cartLines = useMemo(() => lines.map((l) => ({ id: l.product.id, quantity: l.quantity })), [lines]);

  // Analytics: one "started checkout" per visit to this page with something in the cart.
  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (!hydrated || !lines.length || checkoutTracked.current) return;
    checkoutTracked.current = true;
    const units = lines.reduce((n, l) => n + l.quantity, 0);
    track("begin_checkout", { label: `${units} ${units === 1 ? "item" : "items"}`, value: Math.round(lines.reduce((n, l) => n + l.product.price * l.quantity, 0) * 100) });
  }, [hydrated, lines]);

  // A subscriber's email brings the newsletter discount into the quote, once it looks complete.
  const [quoteEmail, setQuoteEmail] = useState("");
  useEffect(() => {
    const email = values.email.trim().toLowerCase();
    const next = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : "";
    const timer = window.setTimeout(() => setQuoteEmail(next), 400);
    return () => window.clearTimeout(timer);
  }, [values.email]);

  // Re-price the cart against the database whenever it (or the email) changes.
  useEffect(() => {
    if (!hydrated || !cartLines.length) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the async quote below
    setQuoting(true);
    quoteCart(cartLines, quoteEmail)
      .then((q) => !cancelled && setQuote(q))
      .finally(() => !cancelled && setQuoting(false));
    return () => {
      cancelled = true;
    };
    // cartKey captures every change to cartLines
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, cartKey, quoteEmail]);

  const set = (key: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };
  const choose = (key: "shipping" | "payment") => (value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const describedBy = (id: keyof Values, hint?: boolean) => (errors[id] ? `${id}-error` : hint ? `${id}-hint` : undefined);
  const shipping = shippingMethods.find((m) => m.code === values.shipping);
  const totalCents = (quote?.subtotalCents ?? 0) - (quote?.discount?.cents ?? 0) + Math.round((shipping?.price ?? 0) * 100);
  const total = totalCents / 100;

  const focusFirstError = (errs: FieldErrors) => {
    const first = (Object.keys(values) as (keyof Values)[]).find((k) => errs[k]);
    if (!first) return;
    const el = formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const checked = validateCheckout(values);
    if (!checked.ok) {
      setErrors(checked.errors);
      focusFirstError(checked.errors);
      return;
    }
    startTransition(async () => {
      const result = await placeOrder({ form: values, lines: cartLines, website: honeypot.current?.value, expectedTotalCents: quote && shipping ? totalCents : undefined });
      if (result.ok) {
        setPlaced(true);
        clearCart();
        router.replace(`/order/${result.token}`);
        return;
      }
      // Show the new total and the message together.
      if (result.unavailable || result.totalChanged) setQuote(await quoteCart(cartLines, values.email));
      // A shipping price may have changed too: fetch the page's prices again (what they typed stays).
      if (result.totalChanged) router.refresh();
      if (result.fieldErrors) {
        setErrors(result.fieldErrors);
        focusFirstError(result.fieldErrors);
      }
      if (result.error) setFormError(result.error);
    });
  };

  if (!hydrated) {
    return (
      <div className="grid gap-8 lg:grid-cols-12" aria-label="Loading checkout">
        <div className="space-y-6 lg:col-span-7">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-[var(--radius-tile)] bg-surface" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-[var(--radius-tile)] bg-surface lg:col-span-5" />
      </div>
    );
  }

  if (!lines.length && !placed) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-surface-2">
          <ShoppingBagOpenIcon className="size-7 text-muted-foreground" />
        </span>
        <h2 className="mt-6 font-display text-2xl font-bold uppercase">Your cart is empty</h2>
        <p className="mt-2 text-muted-foreground">Add a few products, then come back here to check out.</p>
        <Link href="/shop" className="mt-8 inline-flex h-12 items-center rounded-full bg-primary px-7 font-semibold text-primary-foreground">
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
      {/* Mobile: summary collapses above the form. */}
      <details className="group rounded-[var(--radius-tile)] border border-border bg-surface lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2 font-medium">
            Order summary
            <CaretDownIcon className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          </span>
          <span className="font-mono text-lg font-medium">{formatPrice(total)}</span>
        </summary>
        <div className="border-t border-border [&>div]:rounded-none [&>div]:border-0">
          <Summary quote={quote} shipping={shipping} loading={quoting} onEditCart={() => openCart(true)} />
        </div>
      </details>

      <div className="flex flex-col gap-6 lg:col-span-7">
        <Section title="Contact">
          {filledFromOrder && (
            <p className="-mt-2 mb-5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              <CheckIcon weight="bold" className="size-4 text-primary-ink" aria-hidden />
              Filled in from your last order.
              <button type="button" onClick={clearSaved} className="font-medium text-foreground underline-offset-4 hover:underline">
                Clear
              </button>
            </p>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="fullName" label="Full name" error={errors.fullName} className="sm:col-span-2">
              <input
                id="fullName"
                name="fullName"
                autoComplete="name"
                value={values.fullName}
                onChange={set("fullName")}
                aria-invalid={Boolean(errors.fullName)}
                aria-describedby={describedBy("fullName")}
                className={cn(INPUT, errors.fullName ? "border-destructive" : "border-input")}
              />
            </Field>
            <Field id="email" label="Email address" error={errors.email}>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                value={values.email}
                onChange={set("email")}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={describedBy("email")}
                className={cn(INPUT, errors.email ? "border-destructive" : "border-input")}
              />
            </Field>
            <Field id="phone" label="Phone number" error={errors.phone} hint="Australian mobile or landline.">
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="0412 345 678"
                value={values.phone}
                onChange={set("phone")}
                onBlur={() => {
                  const e164 = normaliseAuPhone(values.phone);
                  if (e164) setValues((v) => ({ ...v, phone: formatAuPhone(e164) }));
                }}
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={describedBy("phone", true)}
                className={cn(INPUT, errors.phone ? "border-destructive" : "border-input")}
              />
            </Field>
          </div>
        </Section>

        <Section title="Delivery address">
          <div className="grid gap-5 sm:grid-cols-6">
            <Field id="country" label="Country" hint="We deliver within Australia only." className="sm:col-span-6">
              <div className="relative">
                <input
                  id="country"
                  value="Australia"
                  readOnly
                  tabIndex={-1}
                  aria-readonly
                  aria-describedby="country-hint"
                  className={cn(INPUT, "cursor-not-allowed border-input bg-surface-2/60 pr-11 text-foreground/80 focus:ring-0")}
                />
                <LockSimpleIcon className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              </div>
            </Field>
            <Field id="addressLine1" label="Street address" error={errors.addressLine1} className="sm:col-span-6">
              <input
                id="addressLine1"
                name="addressLine1"
                autoComplete="address-line1"
                placeholder="House number and street"
                value={values.addressLine1}
                onChange={set("addressLine1")}
                aria-invalid={Boolean(errors.addressLine1)}
                aria-describedby={describedBy("addressLine1")}
                className={cn(INPUT, errors.addressLine1 ? "border-destructive" : "border-input")}
              />
            </Field>
            <Field id="addressLine2" label="Apartment, unit or suite" optional error={errors.addressLine2} className="sm:col-span-6">
              <input
                id="addressLine2"
                name="addressLine2"
                autoComplete="address-line2"
                value={values.addressLine2}
                onChange={set("addressLine2")}
                className={cn(INPUT, "border-input")}
              />
            </Field>
            <Field id="suburb" label="Suburb" error={errors.suburb} className="sm:col-span-6 md:col-span-2">
              <input
                id="suburb"
                name="suburb"
                autoComplete="address-level2"
                value={values.suburb}
                onChange={set("suburb")}
                aria-invalid={Boolean(errors.suburb)}
                aria-describedby={describedBy("suburb")}
                className={cn(INPUT, errors.suburb ? "border-destructive" : "border-input")}
              />
            </Field>
            <Field id="state" label="State or territory" error={errors.state} className="sm:col-span-3 md:col-span-2">
              <div className="relative">
                <select
                  id="state"
                  name="state"
                  autoComplete="address-level1"
                  value={values.state}
                  onChange={set("state")}
                  aria-invalid={Boolean(errors.state)}
                  aria-describedby={describedBy("state")}
                  className={cn(INPUT, "appearance-none pr-10", !values.state && "text-muted-foreground", errors.state ? "border-destructive" : "border-input")}
                >
                  <option value="" disabled>
                    Select
                  </option>
                  {AU_STATES.map((s) => (
                    <option key={s.code} value={s.code} className="bg-popover text-popover-foreground">
                      {s.name}
                    </option>
                  ))}
                </select>
                <CaretDownIcon className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              </div>
            </Field>
            <Field id="postcode" label="Postcode" error={errors.postcode} className="sm:col-span-3 md:col-span-2">
              <input
                id="postcode"
                name="postcode"
                autoComplete="postal-code"
                inputMode="numeric"
                placeholder="2000"
                value={values.postcode}
                onChange={(e) => {
                  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
                  set("postcode")(e);
                }}
                aria-invalid={Boolean(errors.postcode)}
                aria-describedby={describedBy("postcode")}
                className={cn(INPUT, errors.postcode ? "border-destructive" : "border-input")}
              />
            </Field>
            <Field id="notes" label="Delivery notes" optional error={errors.notes} className="sm:col-span-6">
              <textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="Gate code, leave at the door, anything we should know"
                value={values.notes}
                onChange={set("notes")}
                className={cn(INPUT, "h-auto resize-y py-3", "border-input")}
              />
            </Field>
          </div>
        </Section>

        <Section title="Shipping">
          <div role="radiogroup" aria-label="Shipping" className="grid gap-3">
            {shippingMethods.map((m) => (
              <Choice
                key={m.code}
                name="shipping"
                value={m.code}
                checked={values.shipping === m.code}
                onChange={choose("shipping")}
                icon={m.code === "express" ? <LightningIcon weight="fill" className="size-5" /> : <TruckIcon weight="fill" className="size-5" />}
                title={m.name}
                detail={m.description}
                aside={formatPrice(m.price)}
              />
            ))}
          </div>
          {errors.shipping && <p className="mt-3 text-sm text-destructive">{errors.shipping}</p>}
        </Section>

        <Section title="Payment">
          <div role="radiogroup" aria-label="Payment method" className="grid gap-3 sm:grid-cols-2">
            {PAYMENT_METHODS.map((p) => (
              <Choice
                key={p.value}
                name="payment"
                value={p.value}
                checked={values.payment === p.value}
                onChange={choose("payment")}
                icon={p.value === "payid" ? <LightningIcon weight="fill" className="size-5" /> : <BankIcon weight="fill" className="size-5" />}
                title={p.label}
                detail={p.detail}
              />
            ))}
          </div>
          {errors.payment && <p className="mt-3 text-sm text-destructive">{errors.payment}</p>}
          <p className="mt-5 rounded-2xl bg-surface-2/70 p-4 text-sm leading-relaxed text-muted-foreground">
            Nothing is charged now. Once you place your order, we&apos;ll send the {paymentPhrase(values.payment)} details by email or live chat
            within 5 minutes.
          </p>
        </Section>

        {/* Honeypot for bots; hidden from people and assistive tech. */}
        <input ref={honeypot} name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

        {formError && (
          <p role="alert" className="flex gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <WarningCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || quoting || !quote?.items.length}
          className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground transition-transform active:scale-[0.99] disabled:opacity-60"
        >
          {pending ? "Placing your order..." : `Place order · ${formatPrice(total)}`}
        </button>
      </div>

      <aside className="hidden lg:col-span-5 lg:block">
        <div className="sticky top-28">
          <Summary quote={quote} shipping={shipping} loading={quoting} onEditCart={() => openCart(true)} />
        </div>
      </aside>
    </form>
  );
}
