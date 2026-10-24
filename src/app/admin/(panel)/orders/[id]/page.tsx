import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { InvoiceTimeline } from "@/components/admin/orders/invoice-timeline";
import { OrderEditor } from "@/components/admin/orders/order-editor";
import { requireAdminPage } from "@/lib/admin/auth";
import { formatDateTime } from "@/lib/admin/format";
import { getAdminOrder } from "@/lib/admin/queries/orders";
import { formatAuPhone } from "@/lib/checkout";
import { prisma } from "@/lib/db";
import { confirmationState } from "@/lib/invoices/rules";

export const metadata: Metadata = { title: "Order" };

/** Where the customer stands with the newest invoice. "Not confirmed yet" only while the order awaits payment. */
function confirmationOf(latest: { askConfirm: boolean; answer: string | null } | null, status: string) {
  if (!latest) return { label: "No invoice sent yet", tone: "neutral" as const };
  const state = confirmationState(latest, status);
  if (state === "confirmed") return { label: "Confirmed by the customer", tone: "success" as const };
  if (state === "disputed") return { label: "The customer says something's wrong", tone: "danger" as const };
  if (state === "waiting") return { label: "Not confirmed yet", tone: "warning" as const };
  return { label: "No confirmation needed now", tone: "neutral" as const };
}

async function OrderView({ params }: Pick<PageProps<"/admin/orders/[id]">, "params">) {
  await requireAdminPage();
  const { id } = await params;
  const [order, shipping] = await Promise.all([
    getAdminOrder(id),
    prisma.shippingMethod.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { code: true, name: true, priceCents: true } }),
  ]);
  if (!order) notFound();
  return (
    <OrderEditor
      // A save changes updatedAt: start the form again from what was saved (new lines now have ids).
      key={order.updatedAt.toISOString()}
      order={{
        id: order.id,
        number: order.number,
        status: order.status,
        placedAt: formatDateTime(order.createdAt),
        paymentMethod: order.paymentMethod,
        details: {
          fullName: order.fullName,
          email: order.email,
          phone: order.phone.startsWith("+61") ? formatAuPhone(order.phone) : order.phone,
          addressLine1: order.addressLine1,
          addressLine2: order.addressLine2 ?? "",
          suburb: order.suburb,
          state: order.state,
          postcode: order.postcode,
        },
        shippingCode: order.shippingCode,
        shippingName: order.shippingName,
        shippingCents: order.shippingCents,
        discountPercent: order.discountPercent,
        discountLabel: order.discountLabel,
        items: order.items.map((i) => ({ id: i.id, productId: i.productId, name: i.name, quantity: i.quantity, unitPriceCents: i.unitPriceCents, image: i.image })),
        conversationId: order.conversationId,
        unsentChanges: order.unsentChanges,
        latestInvoiceVersion: order.latestInvoice?.version ?? null,
      }}
      shippingOptions={shipping}
      confirmation={confirmationOf(order.latestInvoice, order.status)}
      timeline={<InvoiceTimeline order={order} />}
    />
  );
}

export default function OrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-[var(--radius-tile)] bg-surface" aria-label="Loading order" />}>
      <OrderView params={params} />
    </Suspense>
  );
}
