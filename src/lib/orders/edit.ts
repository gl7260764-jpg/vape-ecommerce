import "server-only";
import { prisma } from "@/lib/db";
import { normaliseAuPhone, validateCheckout } from "@/lib/checkout";
import { orderLinesSchema, type OrderLineInput, type OrderStatusInput } from "@/lib/admin/schemas/order";
import { refreshInvoiceMessages } from "@/lib/chat/service";
import { discountCents } from "@/lib/discount";

// Changing an order from the admin. Every amount is worked out here from the lines and shipping;
// nothing the browser sends sets a total. Callers check permissions.

export type OrderEditInput = {
  details: { fullName: string; email: string; phone: string; addressLine1: string; addressLine2: string; suburb: string; state: string; postcode: string };
  shippingCode: string;
  paymentMethod: "bank_transfer" | "payid";
  items: OrderLineInput[];
};

export type OrderEditResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const NEEDS_ATTENTION = "Some fields need attention.";

export async function updateOrder(orderId: string, input: OrderEditInput): Promise<OrderEditResult> {
  const fieldErrors: Record<string, string> = {};
  const checked = validateCheckout({ ...input.details, shipping: String(input.shippingCode ?? ""), payment: String(input.paymentMethod ?? ""), notes: "" });
  if (!checked.ok) Object.assign(fieldErrors, Object.fromEntries(Object.entries(checked.errors).filter(([, v]) => v)));
  const lines = orderLinesSchema.safeParse(input.items);
  if (!lines.success) {
    for (const issue of lines.error.issues) {
      const [index, field] = issue.path;
      fieldErrors[typeof index === "number" && field ? `items.${index}.${String(field)}` : "items"] ??= issue.message;
    }
  }
  if (!checked.ok || !lines.success) return { ok: false, error: NEEDS_ATTENTION, fieldErrors };
  const d = checked.data;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { shippingCode: true, shippingName: true, shippingCents: true, discountPercent: true, items: { select: { id: true } } },
  });
  if (!order) return { ok: false, error: "That order no longer exists." };

  // Keeping the shipping option keeps what was charged; a different one takes today's price.
  let shipping = { code: order.shippingCode, name: order.shippingName, priceCents: order.shippingCents };
  if (d.shipping !== order.shippingCode) {
    const method = await prisma.shippingMethod.findFirst({ where: { code: d.shipping, isActive: true }, select: { code: true, name: true, priceCents: true } });
    if (!method) return { ok: false, error: NEEDS_ATTENTION, fieldErrors: { shipping: "That shipping option isn't available. Choose another." } };
    shipping = method;
  }

  const existing = new Set(order.items.map((i) => i.id));
  const kept = lines.data.filter((l) => l.id && existing.has(l.id));
  const added = lines.data.filter((l) => !l.id || !existing.has(l.id));
  const productIds = added.map((l) => l.productId).filter((id): id is string => Boolean(id));
  const products = new Map(
    (
      await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, slug: true, wooId: true, images: { orderBy: { position: "asc" }, take: 1, select: { key: true } } },
      })
    ).map((p) => [p.id, p])
  );
  const missing = added.findIndex((l) => !l.productId || !products.has(l.productId));
  if (missing !== -1) {
    const index = lines.data.indexOf(added[missing]!);
    return { ok: false, error: NEEDS_ATTENTION, fieldErrors: { [`items.${index}.productId`]: "Pick the product from the catalog." } };
  }

  const subtotalCents = lines.data.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
  // A newsletter order stays 10% off: of the new items total.
  const discount = discountCents(subtotalCents, order.discountPercent);
  await prisma.$transaction([
    prisma.orderItem.deleteMany({ where: { orderId, id: { notIn: kept.map((l) => l.id!) } } }),
    ...kept.map((l) =>
      prisma.orderItem.update({
        where: { id: l.id! },
        data: { name: l.name, quantity: l.quantity, unitPriceCents: l.unitPriceCents, lineTotalCents: l.unitPriceCents * l.quantity },
      })
    ),
    ...added.map((l) => {
      const p = products.get(l.productId!)!;
      return prisma.orderItem.create({
        data: {
          orderId,
          productId: p.id,
          wooId: p.wooId,
          name: l.name,
          slug: p.slug,
          imageKey: p.images[0]?.key ?? null,
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents,
          lineTotalCents: l.unitPriceCents * l.quantity,
        },
      });
    }),
    prisma.order.update({
      where: { id: orderId },
      data: {
        fullName: d.fullName,
        email: d.email,
        phone: normaliseAuPhone(d.phone)!,
        addressLine1: d.addressLine1,
        addressLine2: d.addressLine2 || null,
        suburb: d.suburb,
        state: d.state,
        postcode: d.postcode,
        paymentMethod: d.payment,
        shippingCode: shipping.code,
        shippingName: shipping.name,
        shippingCents: shipping.priceCents,
        subtotalCents,
        discountCents: discount,
        totalCents: subtotalCents - discount + shipping.priceCents,
      },
    }),
  ]);
  return { ok: true };
}

/** Records who changed the status and when, then refreshes the invoice badges in the chat. */
/** Returns false when the order already had that status (nothing changes, nobody is told). */
export async function changeOrderStatus(orderId: string, to: OrderStatusInput, adminId: string): Promise<boolean> {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true, updatedAt: true } });
  if (order.status === to) return false;
  await prisma.$transaction([
    // updatedAt marks edits to what the invoice shows; a status change isn't one, so it keeps its value.
    prisma.order.update({ where: { id: orderId }, data: { status: to, updatedAt: order.updatedAt } }),
    prisma.orderStatusChange.create({ data: { orderId, from: order.status, to, adminId } }),
  ]);
  await refreshInvoiceMessages(orderId);
  return true;
}
