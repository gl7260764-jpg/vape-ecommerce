import "server-only";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { gstCents, invoiceNumber, STORE_WEBSITE } from "@/lib/invoices/rules";
import type { InvoiceSnapshot } from "@/lib/invoices/types";
import { getStoreProfile } from "@/lib/store-profile";

// Invoices are frozen copies of an order, made when they are sent. Callers check permissions.

/** Everything an invoice shows, from the order as it is now. */
export async function buildSnapshot(orderId: string, version: number): Promise<InvoiceSnapshot> {
  const [order, business] = await Promise.all([
    prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        items: { orderBy: { id: "asc" }, include: { product: { select: { puffs: true, brand: { select: { name: true } } } } } },
      },
    }),
    getStoreProfile(),
  ]);
  return {
    number: invoiceNumber(order.number, version),
    orderNumber: order.number,
    issuedAt: new Date().toISOString(),
    taxInvoice: Boolean(business.abn),
    business: { website: STORE_WEBSITE, ...business },
    billedTo: { name: order.fullName, email: order.email, phone: order.phone },
    shipTo: {
      name: order.fullName,
      addressLine1: order.addressLine1,
      addressLine2: order.addressLine2,
      suburb: order.suburb,
      state: order.state,
      postcode: order.postcode,
      shippingName: order.shippingName,
    },
    items: order.items.map((i) => ({
      name: i.name,
      detail: [i.product?.brand?.name, i.product?.puffs ? `${i.product.puffs.toLocaleString("en-AU")} puffs` : null].filter(Boolean).join(" · ") || null,
      imageKey: i.imageKey,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      amountCents: i.lineTotalCents,
    })),
    subtotalCents: order.subtotalCents,
    discountPercent: order.discountPercent,
    discountCents: order.discountCents,
    ...(order.discountLabel ? { discountLabel: order.discountLabel } : {}),
    shippingCents: order.shippingCents,
    gstCents: gstCents(order.totalCents),
    totalCents: order.totalCents,
    paymentMethod: order.paymentMethod,
  };
}

export type CreatedInvoice = { id: string; number: string; version: number; askConfirm: boolean };

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * The order's next invoice, from the order as saved now. The customer is asked to confirm only while
 * the order awaits payment. Two sends at once can't share a version: the loser tries the next one
 * (inside a caller's transaction `db`, the caller retries the whole transaction instead).
 */
export async function createInvoice(orderId: string, opts: { sentById: string | null }, db: Db = prisma): Promise<CreatedInvoice> {
  for (let attempt = 0; ; attempt++) {
    const [latest, order] = await Promise.all([
      prisma.invoice.findFirst({ where: { orderId }, orderBy: { version: "desc" }, select: { version: true } }),
      prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true } }),
    ]);
    const version = (latest?.version ?? 0) + 1;
    const snapshot = await buildSnapshot(orderId, version);
    try {
      return await db.invoice.create({
        data: { orderId, version, number: snapshot.number, snapshot, askConfirm: order.status === "pending_payment", sentById: opts.sentById },
        select: { id: true, number: true, version: true, askConfirm: true },
      });
    } catch (error) {
      if (db === prisma && attempt === 0 && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
}

/** The order's newest invoice, or null. */
export function latestInvoice(orderId: string) {
  return prisma.invoice.findFirst({ where: { orderId }, orderBy: { version: "desc" } });
}
