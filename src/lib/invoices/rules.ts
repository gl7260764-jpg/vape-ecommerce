// Invoice rules shared by the server and the UI. Pure and client-safe.
import type { InvoiceStatus, OrderStatusValue } from "@/lib/invoices/types";

/** INV-10053 for the first invoice of an order, then INV-10053-2, INV-10053-3. */
export const invoiceNumber = (orderNumber: number, version: number) => (version <= 1 ? `INV-${orderNumber}` : `INV-${orderNumber}-${version}`);

/** Prices include GST: the GST part is one eleventh of the total. */
export const gstCents = (totalCents: number) => Math.round(totalCents / 11);

/** The badge: an older invoice is REPLACED; otherwise it follows the order (paid covers packing, shipped, delivered). */
export function invoiceStatus(orderStatus: string, latest: boolean): InvoiceStatus {
  if (!latest) return "replaced";
  if (orderStatus === "cancelled") return "cancelled";
  if (orderStatus === "pending_payment") return "payment_due";
  return "paid";
}

/** The two buttons work only on the order's newest invoice, while payment is due, until answered. */
export function canAnswerInvoice(invoice: { latest: boolean; askConfirm: boolean; answer: string | null; status: InvoiceStatus }): boolean {
  return invoice.latest && invoice.askConfirm && !invoice.answer && invoice.status === "payment_due";
}

/**
 * Where the customer stands with the newest invoice: waiting (only while the order awaits payment),
 * confirmed, disputed, or null when there's nothing to confirm (no question, or the order moved on).
 */
export function confirmationState(invoice: { askConfirm: boolean; answer: string | null } | null, orderStatus: string): "waiting" | "confirmed" | "disputed" | null {
  if (!invoice?.askConfirm) return null;
  if (invoice.answer === "confirmed" || invoice.answer === "disputed") return invoice.answer;
  return orderStatus === "pending_payment" ? "waiting" : null;
}

export const INVOICE_BADGE: Record<InvoiceStatus, string> = {
  payment_due: "PAYMENT DUE",
  paid: "PAID",
  cancelled: "CANCELLED",
  replaced: "REPLACED",
};

/** Exact customer-facing copy from the spec. */
export const INVOICE_COPY = {
  question: "Please check your invoice. Are your items, delivery address and contact details all correct?",
  yesButton: "Yes, all correct",
  noButton: "Something's wrong",
  yesMessage: "Yes, all correct",
  noMessage: "Something's wrong with my invoice",
  yesReply: "Thanks for confirming! We'll send your payment details here within 5 minutes.",
  noReply: "No problem. Tell us what needs changing and we'll send you an updated invoice.",
  paymentNote: "Payment details are sent in your chat",
  openFull: "Open full invoice · Save as PDF",
} as const;

export const ORDER_STATUS_LABEL: Record<OrderStatusValue, string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid",
  processing: "Packing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const STORE_WEBSITE = "bestvapeshopaustralia.com.au";
