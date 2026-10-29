"use server";

import { randomBytes } from "node:crypto";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { alertNewOrder } from "@/lib/alerts";
import {
  deliveryCents,
  minimumOrderMessage,
  normaliseAuPhone,
  orderNumber,
  shortOfMinimumCents,
  validateCheckout,
  type CartLineInput,
  type CheckoutFormValues,
  type FieldErrors,
} from "@/lib/checkout";
import { priceLines, type PricedLine } from "@/lib/checkout-queries";
import { currentVisit, existingVisitorId, recordServerEvent } from "@/lib/analytics/record";
import { savedCheckoutDetails, type SavedCheckoutDetails } from "@/lib/checkout-details";
import { currentDeviceTokenHash, grantOrderAccess } from "@/lib/customer-orders";
import { openOrderConversation } from "@/lib/chat/service";
import { discountCents } from "@/lib/discount";
import { claimDiscount, welcomeDiscountFor } from "@/lib/newsletter";

export type Quote = { items: PricedLine[]; unavailable: string[]; subtotalCents: number; discount: { percent: number; cents: number; label: string } | null };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A returning customer's details for the checkout: from the last order placed on this device, or just
 * the email of the account it's signed into (never another device's address or phone).
 */
export async function savedDetails(): Promise<SavedCheckoutDetails | null> {
  return savedCheckoutDetails(await currentDeviceTokenHash()).catch((error) => {
    console.error("saved checkout details failed", error);
    return null;
  });
}

/** The browser placing the order, for the app's 10% (installed on this device). */
const thisVisitor = async () => (await currentVisit().catch(() => null))?.visitorId ?? null;

/**
 * Current prices and availability for the cart, shown in the checkout summary. With an email whose
 * welcome discount is unused (subscribed, and/or the app installed), the quote includes it.
 */
export async function quoteCart(lines: CartLineInput[], email?: string): Promise<Quote> {
  const priced = await priceLines(Array.isArray(lines) ? lines : []);
  const address = typeof email === "string" ? email.trim().toLowerCase() : "";
  const welcome = address && EMAIL.test(address) ? await welcomeDiscountFor(address, await thisVisitor()).catch(() => null) : null;
  return { ...priced, discount: welcome ? { ...welcome, cents: discountCents(priced.subtotalCents, welcome.percent) } : null };
}

const TOTAL_CHANGED = "Your total changed. Check the new total, then place your order again.";

export type PlaceOrderResult =
  | { ok: true; token: string }
  | { ok: false; error?: string; fieldErrors?: FieldErrors; unavailable?: string[]; totalChanged?: boolean };

/** Thrown inside the order transaction when the discount was claimed by another order a moment earlier. */
class DiscountGone extends Error {}

/**
 * Creates the order. The form is validated again here and every price comes from the database,
 * so nothing the browser sends can change what the customer is charged.
 */
export async function placeOrder(input: { form: CheckoutFormValues; lines: CartLineInput[]; website?: string; expectedTotalCents?: number }): Promise<PlaceOrderResult> {
  // Honeypot: real customers never see or fill this field.
  if (input.website) return { ok: false, error: "Something went wrong. Please try again." };

  const checked = validateCheckout(input.form);
  if (!checked.ok) return { ok: false, fieldErrors: checked.errors };
  const form = checked.data;

  const [{ items, unavailable, subtotalCents }, methods] = await Promise.all([
    priceLines(Array.isArray(input.lines) ? input.lines : []),
    prisma.shippingMethod.findMany({ where: { isActive: true }, select: { code: true, name: true, priceCents: true } }),
  ]);
  if (unavailable.length) {
    return { ok: false, unavailable, error: "Some items in your cart are no longer available. Remove them and try again." };
  }
  if (!items.length) return { ok: false, error: "Your cart is empty." };
  if (shortOfMinimumCents(subtotalCents)) return { ok: false, error: minimumOrderMessage(subtotalCents) };
  const method = methods.find((m) => m.code === form.shipping);
  if (!method) return { ok: false, fieldErrors: { shipping: "That shipping option isn't available. Choose another." } };
  // From $500 the cheapest delivery is free and comes off the others.
  const shipping = { ...method, priceCents: deliveryCents(method.priceCents, methods.map((m) => m.priceCents), subtotalCents) };

  // The welcome discount, decided here; the customer is never charged a total they weren't shown.
  const welcome = await welcomeDiscountFor(form.email, await thisVisitor());
  const percent = welcome?.percent ?? 0;
  const discount = discountCents(subtotalCents, percent);
  const totalCents = subtotalCents - discount + shipping.priceCents;
  if (typeof input.expectedTotalCents === "number" && input.expectedTotalCents !== totalCents) {
    return { ok: false, totalChanged: true, error: TOTAL_CHANGED };
  }

  try {
    const visit = await currentVisit();
    const visitorId = await existingVisitorId(visit.visitorId).catch(() => null);
    const phone = normaliseAuPhone(form.phone)!;
    // The customer's account: made with their first order, no password. Details follow the latest order.
    const customer = await prisma.customer.upsert({
      where: { email: form.email },
      create: { email: form.email, name: form.fullName, phone },
      update: { name: form.fullName, phone },
      select: { id: true },
    });
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          visitorId,
          customerId: customer.id,
          publicToken: randomBytes(18).toString("base64url"),
          paymentMethod: form.payment,
          fullName: form.fullName,
          email: form.email,
          phone,
          addressLine1: form.addressLine1,
          addressLine2: form.addressLine2 || null,
          suburb: form.suburb,
          state: form.state,
          postcode: form.postcode,
          shippingCode: shipping.code,
          shippingName: shipping.name,
          shippingCents: shipping.priceCents,
          subtotalCents,
          discountPercent: percent,
          discountLabel: welcome?.label ?? null,
          discountCents: discount,
          totalCents,
          notes: form.notes || null,
          items: {
            create: items.map((i) => ({
              productId: i.productId,
              wooId: Number(i.id),
              name: i.name,
              slug: i.slug,
              imageKey: i.imageKey,
              unitPriceCents: i.unitPriceCents,
              quantity: i.quantity,
              lineTotalCents: i.lineTotalCents,
            })),
          },
        },
        select: { id: true, publicToken: true, number: true, totalCents: true },
      });
      // Claimed with the order: of two orders at once with this email, only one gets the 10%.
      if (percent && !(await claimDiscount(tx, form.email, created.id, percent))) throw new DiscountGone();
      return created;
    });
    // This browser is now signed in to the order: it shows under "My orders" here from now on.
    const tokenHash = await grantOrderAccess(order.id).catch((error) => {
      console.error("could not save the order to this device", error);
      return null;
    });
    // ...and its chat with the store opens with this order in it.
    if (tokenHash) {
      after(() =>
        openOrderConversation(tokenHash, {
          id: order.id,
          number: order.number,
          totalCents: order.totalCents,
          paymentMethod: form.payment,
          customerId: customer.id,
          fullName: form.fullName,
          email: form.email,
        }).catch((error) => console.error("could not open the order chat", error))
      );
    }
    after(() =>
      recordServerEvent({ ...visit, type: "place_order", path: "/checkout", label: orderNumber(order.number), value: order.totalCents, email: form.email })
    );
    after(() => alertNewOrder(order.id)); // the team's phones (ntfy)
    return { ok: true, token: order.publicToken };
  } catch (error) {
    if (error instanceof DiscountGone) return { ok: false, totalChanged: true, error: TOTAL_CHANGED };
    console.error("placeOrder failed", error);
    return { ok: false, error: "We couldn't place your order just now. Please try again." };
  }
}
