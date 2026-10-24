import "server-only";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/auth";
import type { Prisma } from "@/generated/prisma/client";

export const SUBSCRIBER_PAGE_SIZE = 50;
export const SUBSCRIBER_VIEWS = ["all", "recent", "customers", "tracked"] as const;
export type SubscriberView = (typeof SUBSCRIBER_VIEWS)[number];
export type SubscriberParams = { q: string; view: SubscriberView; page: number };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseSubscriberParams(sp: Record<string, string | string[] | undefined>): SubscriberParams {
  const view = first(sp.view);
  const page = Number.parseInt(first(sp.page), 10);
  return {
    q: first(sp.q).trim().slice(0, 100),
    view: (SUBSCRIBER_VIEWS as readonly string[]).includes(view) ? (view as SubscriberView) : "all",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function subscriberQuery(params: SubscriberParams, change: Partial<SubscriberParams> = {}) {
  const next = { ...params, page: 1, ...change };
  const qs = new URLSearchParams();
  if (next.q) qs.set("q", next.q);
  if (next.view !== "all") qs.set("view", next.view);
  if (next.page > 1) qs.set("page", String(next.page));
  return qs.toString();
}

/** Ids of subscribers whose email has placed at least one order. */
async function customerIds() {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT s.id FROM "Subscriber" s WHERE EXISTS (SELECT 1 FROM "Order" o WHERE lower(o.email) = lower(s.email))`;
  return rows.map((r) => r.id);
}

/** The filter as a where clause. Shared by the page and the CSV export so they always match. */
export async function subscriberWhere(params: Pick<SubscriberParams, "q" | "view">): Promise<Prisma.SubscriberWhereInput> {
  const and: Prisma.SubscriberWhereInput[] = [];
  if (params.q) and.push({ email: { contains: params.q, mode: "insensitive" } });
  if (params.view === "recent") and.push({ createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } });
  if (params.view === "tracked") and.push({ visitorId: { not: null } });
  if (params.view === "customers") and.push({ id: { in: await customerIds() } });
  return { AND: and };
}

export const subscriberSelect = {
  id: true,
  email: true,
  source: true,
  createdAt: true,
  visitor: { select: { id: true, city: true, region: true, country: true, firstSource: true, firstChannel: true, device: true, sessionCount: true, lastSeenAt: true } },
} satisfies Prisma.SubscriberSelect;

/** Orders per email (case-insensitive), for the "customer" column. */
export async function ordersByEmail(emails: string[]) {
  if (!emails.length) return new Map<string, { orders: number; totalCents: number }>();
  const rows = await prisma.$queryRaw<{ email: string; orders: number; total: number }[]>`
    SELECT lower(email) AS email, count(*)::int AS orders, coalesce(sum("totalCents"), 0)::int AS total
    FROM "Order" WHERE lower(email) = ANY(${emails.map((e) => e.toLowerCase())}) AND status <> 'cancelled'
    GROUP BY lower(email)`;
  return new Map(rows.map((r) => [r.email, { orders: r.orders, totalCents: r.total }]));
}

export async function listSubscribers(params: SubscriberParams) {
  await requireAdmin();
  const where = await subscriberWhere(params);
  const [rows, total, counts] = await Promise.all([
    prisma.subscriber.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * SUBSCRIBER_PAGE_SIZE,
      take: SUBSCRIBER_PAGE_SIZE,
      select: subscriberSelect,
    }),
    prisma.subscriber.count({ where }),
    Promise.all(SUBSCRIBER_VIEWS.map(async (view) => prisma.subscriber.count({ where: await subscriberWhere({ q: params.q, view }) }))),
  ]);
  const orders = await ordersByEmail(rows.map((r) => r.email));
  return {
    rows: rows.map((r) => ({ ...r, orders: orders.get(r.email.toLowerCase()) ?? { orders: 0, totalCents: 0 } })),
    total,
    pageCount: Math.max(1, Math.ceil(total / SUBSCRIBER_PAGE_SIZE)),
    counts: Object.fromEntries(SUBSCRIBER_VIEWS.map((v, i) => [v, counts[i]])) as Record<SubscriberView, number>,
  };
}

export type SubscriberRow = Awaited<ReturnType<typeof listSubscribers>>["rows"][number];
