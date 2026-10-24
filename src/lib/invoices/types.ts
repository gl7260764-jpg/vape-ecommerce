// What an invoice shows, frozen when it is sent. Client-safe (types only).

export type OrderStatusValue = "pending_payment" | "paid" | "processing" | "shipped" | "delivered" | "cancelled";

export type InvoiceSnapshot = {
  number: string;
  orderNumber: number;
  issuedAt: string;
  /** An ABN is on file, so the title reads "TAX INVOICE". */
  taxInvoice: boolean;
  business: { website: string; email: string | null; phone: string | null; address: string | null; abn: string | null };
  billedTo: { name: string; email: string; phone: string };
  shipTo: { name: string; addressLine1: string; addressLine2: string | null; suburb: string; state: string; postcode: string; shippingName: string };
  items: { name: string; detail: string | null; imageKey: string | null; quantity: number; unitPriceCents: number; amountCents: number }[];
  subtotalCents: number;
  /** Newsletter discount. Missing on invoices sent before discounts existed (read as 0). */
  discountPercent?: number;
  discountCents?: number;
  /** How the discount line reads, e.g. "Newsletter + app discount (20%)". Missing before labels (read as the newsletter one). */
  discountLabel?: string;
  shippingCents: number;
  gstCents: number;
  totalCents: number;
  paymentMethod: "bank_transfer" | "payid";
};

export type InvoiceStatus = "payment_due" | "paid" | "cancelled" | "replaced";
