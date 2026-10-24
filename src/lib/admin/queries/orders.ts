import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { ORDER_STATUSES, type OrderStatusInput } from "@/lib/admin/schemas/order";
import { mediaUrl } from "@/lib/catalog";
import { prisma } from "@/lib/db";

// The admin's view of orders. Callers check requireAdmin() first.

export const ORDER_PAGE_SIZE = 50;

export type OrderListParams = { q: string; status: OrderStatusInput | ""; page: number };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseOrderParams(sp: Record<string, string | string[] | undefined>): OrderListParams {
  const status = first(sp.status);
  const page = Number.parseInt(first(sp.page), 10);
  return {
    q: first(sp.q).trim().slice(0, 100),
    status: (ORDER_STATUSES as readonly string[]).includes(status) ? (status as OrderStatusInput) : "",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function orderListHref(params: OrderListParams, change: Partial<OrderListParams>) {
  const next = { ...params, page: 1, ...change };
  const qs = new URLSearchParams();
  if (next.q) qs.set("q", next.q);
  if (next.status) qs.set("status", next.status);
  if (next.page > 1) qs.set("page", String(next.page));
  const s = qs.toString();
  return s ? `/admin/orders?${s}` : "/admin/orders";
}

function searchWhere(q: string): Prisma.OrderWhereInput {
  if (!q) return {};
  const number = /^(?:bv-?)?(\d{1,9})$/i.exec(q)?.[1];
  return {
    OR: [
      ...(number ? [{ number: Number(number) }] : []),
      { fullName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ],
  };
}

/** Newest first, 50 a page; `counts` are per status for the current search. */
export async function listAdminOrders(params: OrderListParams) {
  const base = searchWhere(params.q);
  const where: Prisma.OrderWhereInput = { ...base, ...(params.status && { status: params.status }) };
  const [rows, total, grouped] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * ORDER_PAGE_SIZE,
      take: ORDER_PAGE_SIZE,
      select: { id: true, number: true, fullName: true, email: true, totalCents: true, status: true, createdAt: true, _count: { select: { items: true } } },
    }),
    prisma.order.count({ where }),
    prisma.order.groupBy({ by: ["status"], where: base, _count: true }),
  ]);
  const counts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<OrderStatusInput, number>;
  for (const g of grouped) counts[g.status] = g._count;
  return {
    rows,
    total,
    counts,
    all: Object.values(counts).reduce((a, b) => a + b, 0),
    pageCount: Math.max(1, Math.ceil(total / ORDER_PAGE_SIZE)),
  };
}

export type AdminOrderRow = Awaited<ReturnType<typeof listAdminOrders>>["rows"][number];

/** One order with its lines, invoices, status history and chat, for the order page. */
export async function getAdminOrder(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { orderBy: { id: "asc" }, include: { product: { select: { images: { orderBy: { position: "asc" }, take: 1, select: { key: true } } } } } },
      invoices: {
        orderBy: { version: "asc" },
        select: { id: true, number: true, version: true, askConfirm: true, answer: true, answeredAt: true, createdAt: true, sentBy: { select: { name: true } } },
      },
      statusChanges: { orderBy: { createdAt: "asc" }, select: { id: true, from: true, to: true, createdAt: true, admin: { select: { name: true } } } },
    },
  });
  if (!order) return null;
  const access = await prisma.orderAccess.findFirst({ where: { orderId: id, fullDetails: true }, orderBy: { createdAt: "asc" }, select: { tokenHash: true } });
  const conversation = access ? await prisma.chatConversation.findUnique({ where: { deviceTokenHash: access.tokenHash }, select: { id: true } }) : null;
  const latest = order.invoices.at(-1) ?? null;
  return {
    ...order,
    items: order.items.map((i) => ({ ...i, image: i.imageKey ? mediaUrl(i.imageKey) : i.product?.images[0]?.key ? mediaUrl(i.product.images[0].key) : null })),
    conversationId: conversation?.id ?? null,
    latestInvoice: latest,
    // Saved edits the customer hasn't been sent yet (status changes keep updatedAt, so they don't count).
    unsentChanges: latest !== null && order.updatedAt > latest.createdAt,
  };
}

export type AdminOrder = NonNullable<Awaited<ReturnType<typeof getAdminOrder>>>;

/** Catalog products to add to an order: live and purchasable, by name. */
export async function searchOrderProducts(q: string) {
  const text = q.trim().slice(0, 100);
  if (text.length < 2) return [];
  const rows = await prisma.product.findMany({
    where: { status: "active", isPurchasable: true, name: { contains: text, mode: "insensitive" } },
    orderBy: { name: "asc" },
    take: 20,
    select: { id: true, name: true, priceCents: true, images: { orderBy: { position: "asc" }, take: 1, select: { key: true } } },
  });
  return rows.map((p) => ({ id: p.id, name: p.name, priceCents: p.priceCents, image: p.images[0]?.key ? mediaUrl(p.images[0].key) : null }));
}

export type OrderProductOption = Awaited<ReturnType<typeof searchOrderProducts>>[number];
