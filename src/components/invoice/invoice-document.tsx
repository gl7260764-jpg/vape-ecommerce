import { formatPrice } from "@/lib/catalog";
import { formatAuPhone, orderNumber, paymentLabel } from "@/lib/checkout";
import { DISCOUNT_LABEL } from "@/lib/discount";
import { INVOICE_BADGE, INVOICE_COPY } from "@/lib/invoices/rules";
import type { InvoiceSnapshot, InvoiceStatus } from "@/lib/invoices/types";
import { cn } from "@/lib/utils";

// The invoice, drawn from its frozen snapshot. Always paper-white with a black header and the lime
// rule, in both themes, so it reads and prints the same everywhere. "page" is the full document
// (also what prints); "compact" is the phone-sized version inside a chat bubble. No hooks: renders
// on the server (invoice pages) and the client (chat).

const money = (cents: number) => formatPrice(cents / 100);
const longDate = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Sydney" });
const shortDate = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Sydney" });
const abnText = (abn: string) => abn.replace(/^(\d{2})(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3 $4");
const phoneText = (e164: string) => (e164.startsWith("+61") ? formatAuPhone(e164) : e164);

const BADGE_TONE: Record<InvoiceStatus, string> = {
  payment_due: "border-[#b7d63a] bg-[#f1fbc9] text-[#4d5f06]",
  paid: "border-[#86d5ae] bg-[#e3f7ec] text-[#0f5e3a]",
  cancelled: "border-[#f0b4b4] bg-[#fdecec] text-[#8f1d1d]",
  replaced: "border-[#cfd3da] bg-[#eef0f3] text-[#4b505b]",
};

function Badge({ status, className }: { status: InvoiceStatus; className?: string }) {
  return (
    <span className={cn("inline-block rounded-[3px] border px-2.5 py-1.5 text-[10px] font-bold tracking-[0.16em] whitespace-nowrap", BADGE_TONE[status], className)}>
      {INVOICE_BADGE[status]}
    </span>
  );
}

function Mark({ small = false }: { small?: boolean }) {
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-full bg-primary font-display font-black text-[#121408]", small ? "size-6 text-[11px]" : "size-10 text-base")}>
      B
    </span>
  );
}

const Label = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <p className={cn("mb-1.5 text-[9px] font-semibold tracking-[0.2em] text-[#7a808c] uppercase", className)}>{children}</p>
);

function Replaced() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden">
      <span className="-rotate-12 rounded border-4 border-[#9aa0ab]/70 px-6 py-2 text-3xl font-black tracking-[0.3em] text-[#9aa0ab]/70">REPLACED</span>
    </div>
  );
}

export function InvoiceDocument({ snapshot: s, status, layout }: { snapshot: InvoiceSnapshot; status: InvoiceStatus; layout: "page" | "compact" }) {
  const title = s.taxInvoice ? "TAX INVOICE" : "INVOICE";
  const addressLines = [s.shipTo.addressLine1, s.shipTo.addressLine2, `${s.shipTo.suburb} ${s.shipTo.state} ${s.shipTo.postcode}`].filter(Boolean) as string[];
  const business = [s.business.website, s.business.email, s.business.phone && phoneText(s.business.phone), ...(s.business.address?.split("\n") ?? [])].filter(Boolean) as string[];

  const totals = (
    <>
      <div className="flex justify-between gap-3 py-1 text-[#3b3f48]">
        <span>Subtotal</span>
        <span className="font-mono font-semibold text-[#15171c]">{money(s.subtotalCents)}</span>
      </div>
      {(s.discountCents ?? 0) > 0 && (
        <div className="flex justify-between gap-3 py-1 text-[#3b3f48]">
          <span>{s.discountLabel ?? DISCOUNT_LABEL(s.discountPercent ?? 0)}</span>
          <span className="font-mono font-semibold text-[#4d5f06]">-{money(s.discountCents ?? 0)}</span>
        </div>
      )}
      <div className="flex justify-between gap-3 py-1 text-[#3b3f48]">
        <span>{s.shipTo.shippingName}</span>
        <span className="font-mono font-semibold text-[#15171c]">{money(s.shippingCents)}</span>
      </div>
      <div className="flex justify-between gap-3 py-1 text-[#3b3f48]">
        <span>GST included</span>
        <span className="font-mono font-semibold text-[#15171c]">{money(s.gstCents)}</span>
      </div>
    </>
  );

  const payment = (
    <div className="border border-l-4 border-[#e3e5ea] border-l-primary bg-white px-4 py-3">
      <Label className="mb-1">Payment method</Label>
      <p className="font-bold">{paymentLabel(s.paymentMethod)}</p>
      <p className="mt-1 text-[11px] text-[#7a808c]">{INVOICE_COPY.paymentNote}</p>
    </div>
  );

  if (layout === "compact") {
    return (
      <article aria-label={`Invoice ${s.number}`} className="relative overflow-hidden rounded-2xl bg-[#fafafa] text-[12px] leading-snug text-[#15171c] shadow-[0_1px_0_var(--border)]">
        <header className="border-b-[3px] border-primary bg-[#0b0c0f] px-3.5 pt-3.5 pb-3 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Mark small />
              <span className="truncate text-[12px] font-extrabold tracking-[0.03em]">BEST VAPE SHOP</span>
            </div>
            <div className="text-right">
              <p className="font-extrabold tracking-[0.14em]">{title}</p>
              <p className="font-mono text-[10px] text-[#9aa0ab]">{s.number}</p>
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] text-[#9aa0ab]">
            <span>
              Order <b className="font-mono text-white">{orderNumber(s.orderNumber)}</b> · {shortDate.format(new Date(s.issuedAt))}
            </span>
            <Badge status={status} className="px-2 py-0.5 text-[9px]" />
          </div>
        </header>
        <div className="px-3.5 py-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <Label>Billed to</Label>
              <p className="font-semibold break-words">{s.billedTo.name}</p>
              <p className="text-[11px] break-all text-[#3b3f48]">{s.billedTo.email}</p>
              <p className="text-[11px] text-[#3b3f48]">{phoneText(s.billedTo.phone)}</p>
            </div>
            <div className="min-w-0">
              <Label>Shipped to</Label>
              <p className="text-[11px] break-words text-[#3b3f48]">
                {addressLines.map((l) => (
                  <span key={l} className="block">
                    {l}
                  </span>
                ))}
                <span className="block">{s.shipTo.shippingName}</span>
              </p>
            </div>
          </div>
          <ul className="mt-3 border-t border-[#e3e5ea]">
            {s.items.map((item, i) => (
              <li key={i} className="flex justify-between gap-3 border-b border-[#e3e5ea] py-2">
                <span className="min-w-0">
                  <span className="block font-semibold break-words">{item.name}</span>
                  <span className="block font-mono text-[11px] text-[#7a808c]">
                    {item.quantity} × {money(item.unitPriceCents)}
                  </span>
                </span>
                <span className="shrink-0 font-mono">{money(item.amountCents)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2">{totals}</div>
          <div className="mt-2 flex items-center justify-between gap-3 bg-[#0b0c0f] px-3 py-2.5 text-white">
            <span className="text-[9px] font-semibold tracking-[0.2em] text-primary">TOTAL DUE (AUD)</span>
            <span className="font-mono text-lg font-bold">{money(s.totalCents)}</span>
          </div>
          <div className="mt-3">{payment}</div>
        </div>
        {status === "replaced" && <Replaced />}
      </article>
    );
  }

  return (
    <article aria-label={`Invoice ${s.number}`} className="relative overflow-hidden bg-[#fafafa] text-[13px] text-[#15171c] shadow-[0_20px_60px_-30px_rgba(0,0,0,0.6)] print:shadow-none sm:rounded-md">
      <header className="border-b-[3px] border-primary bg-[#0b0c0f] px-5 pt-7 pb-6 text-white sm:px-10 sm:pt-9">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-center gap-3">
            <Mark />
            <div>
              <p className="text-lg leading-none font-extrabold tracking-[0.02em]">BEST VAPE SHOP</p>
              <p className="mt-1 text-[10px] tracking-[0.22em] text-primary">AUSTRALIA</p>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-3xl leading-none font-extrabold tracking-[0.14em] sm:text-[2.6rem]">{title}</p>
            <p className="mt-2 font-mono text-xs tracking-[0.08em] text-[#9aa0ab]">{s.number}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-6 border-t border-[#2a2d35] pt-5">
          <div className="text-xs leading-relaxed break-words text-[#9aa0ab]">
            {business.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {s.business.abn && <p>ABN {abnText(s.business.abn)}</p>}
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-3">
            {[
              ["Order", orderNumber(s.orderNumber), true],
              ["Issued", longDate.format(new Date(s.issuedAt)), false],
              ["Terms", "Due on receipt", false],
            ].map(([k, v, mono]) => (
              <div key={k as string} className="sm:text-right">
                <dt className="text-[9px] tracking-[0.2em] text-[#8a909b] uppercase">{k}</dt>
                <dd className={cn("mt-1 text-sm font-semibold", mono && "font-mono")}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <div className="px-5 py-7 sm:px-10 sm:py-9">
        <div className="grid gap-6 sm:grid-cols-[1fr_1fr_auto]">
          <div className="min-w-0">
            <Label>Billed to</Label>
            <p className="text-[15px] font-bold break-words">{s.billedTo.name}</p>
            <p className="leading-relaxed break-all text-[#3b3f48]">{s.billedTo.email}</p>
            <p className="leading-relaxed text-[#3b3f48]">{phoneText(s.billedTo.phone)}</p>
          </div>
          <div className="min-w-0">
            <Label>Shipped to</Label>
            <p className="text-[15px] font-bold break-words">{s.shipTo.name}</p>
            <p className="leading-relaxed break-words text-[#3b3f48]">
              {addressLines.map((l) => (
                <span key={l} className="block">
                  {l}
                </span>
              ))}
              <span className="block">Australia</span>
              <span className="block">{s.shipTo.shippingName}</span>
            </p>
          </div>
          <div className="row-start-1 sm:row-auto">
            <Badge status={status} />
          </div>
        </div>

        <div className="mt-8">
          <div className="hidden grid-cols-[1fr_4rem_7rem_7rem] gap-4 bg-[#0b0c0f] px-4 py-3 text-[9px] font-bold tracking-[0.2em] text-white sm:grid">
            <span>DESCRIPTION</span>
            <span className="text-right">QTY</span>
            <span className="text-right">UNIT PRICE</span>
            <span className="text-right">AMOUNT</span>
          </div>
          <ul className="border-t-2 border-[#0b0c0f] sm:border-t-0">
            {s.items.map((item, i) => (
              <li key={i} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-b border-[#e3e5ea] px-1 py-3.5 sm:grid-cols-[1fr_4rem_7rem_7rem] sm:px-4">
                <div className="min-w-0">
                  <p className="font-bold break-words">{item.name}</p>
                  {item.detail && <p className="text-[11px] text-[#7a808c]">{item.detail}</p>}
                  <p className="font-mono text-[11px] text-[#7a808c] sm:hidden">
                    {item.quantity} × {money(item.unitPriceCents)}
                  </p>
                </div>
                <span className="hidden text-right sm:block">{item.quantity}</span>
                <span className="hidden text-right font-mono sm:block">{money(item.unitPriceCents)}</span>
                <span className="text-right font-mono">{money(item.amountCents)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-7 flex flex-col-reverse gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="sm:min-w-56">{payment}</div>
          <div className="w-full sm:w-80">
            {totals}
            <div className="mt-3 flex items-center justify-between gap-4 bg-[#0b0c0f] px-5 py-4 text-white">
              <span className="text-[10px] font-semibold tracking-[0.2em] text-primary">TOTAL DUE (AUD)</span>
              <span className="font-mono text-2xl font-bold sm:text-[1.75rem]">{money(s.totalCents)}</span>
            </div>
          </div>
        </div>

        <footer className="mt-9 border-t border-[#e3e5ea] pt-4 text-[11px] leading-relaxed text-[#8a909b]">
          <p>Best Vape Shop Australia · Use {orderNumber(s.orderNumber)} as your payment reference.</p>
          <p>Thank you for your order.</p>
        </footer>
      </div>
      {status === "replaced" && <Replaced />}
    </article>
  );
}
