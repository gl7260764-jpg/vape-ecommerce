import "server-only";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/auth";
import { visitorRowSelect } from "@/lib/admin/queries/analytics";
import { storeDayStart } from "@/lib/admin/time";
import { CHANNELS } from "@/lib/analytics/labels";
import type { Prisma, TrafficChannel } from "@/generated/prisma/client";

export const VISITOR_PAGE_SIZE = 30;
export const VISITOR_VIEWS = ["all", "new", "returning", "identified", "customers"] as const;
export type VisitorView = (typeof VISITOR_VIEWS)[number];

export type VisitorListParams = { q: string; view: VisitorView; channel: TrafficChannel | ""; country: string; page: number; all: boolean };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseVisitorParams(sp: Record<string, string | string[] | undefined>): VisitorListParams {
  const view = first(sp.view);
  const channel = first(sp.channel);
  const country = first(sp.country).toUpperCase();
  const page = Number.parseInt(first(sp.page), 10);
  return {
    q: first(sp.q).trim().slice(0, 100),
    view: (VISITOR_VIEWS as readonly string[]).includes(view) ? (view as VisitorView) : "all",
    channel: (CHANNELS as string[]).includes(channel) ? (channel as TrafficChannel) : "",
    country: /^[A-Z]{2}$/.test(country) ? country : "",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    all: first(sp.all) === "1",
  };
}

export function visitorListHref(params: VisitorListParams, change: Partial<VisitorListParams>) {
  const next = { ...params, page: 1, ...change };
  const qs = new URLSearchParams();
  if (next.q) qs.set("q", next.q);
  if (next.view !== "all") qs.set("view", next.view);
  if (next.channel) qs.set("channel", next.channel);
  if (next.country) qs.set("country", next.country);
  if (next.all) qs.set("all", "1");
  if (next.page > 1) qs.set("page", String(next.page));
  const s = qs.toString();
  return s ? `/admin/analytics/visitors?${s}` : "/admin/analytics/visitors";
}

const viewWhere = (view: VisitorView): Prisma.VisitorWhereInput =>
  ({
    all: {},
    new: { firstSeenAt: { gte: storeDayStart(0) } },
    returning: { sessionCount: { gt: 1 } },
    identified: { email: { not: null } },
    customers: { orders: { some: {} } },
  })[view];

/** Email, a 2-letter country code, a city, an IP, or the start of a visitor id. */
function searchWhere(q: string): Prisma.VisitorWhereInput | undefined {
  if (!q) return undefined;
  const or: Prisma.VisitorWhereInput[] = [
    { email: { contains: q, mode: "insensitive" } },
    { city: { contains: q, mode: "insensitive" } },
    { region: { contains: q, mode: "insensitive" } },
    { id: { startsWith: q.toLowerCase() } },
  ];
  if (/^[A-Za-z]{2}$/.test(q)) or.push({ country: q.toUpperCase() });
  if (/^[\d.:a-f]+$/i.test(q)) or.push({ ip: { startsWith: q } });
  return { OR: or };
}

export async function listVisitors(params: VisitorListParams) {
  await requireAdmin();
  const scope: Prisma.VisitorWhereInput = params.all ? {} : { isBot: false, isInternal: false };
  const base: Prisma.VisitorWhereInput[] = [scope];
  const search = searchWhere(params.q);
  if (search) base.push(search);
  if (params.channel) base.push({ firstChannel: params.channel });
  if (params.country) base.push({ country: params.country });
  const where: Prisma.VisitorWhereInput = { AND: [...base, viewWhere(params.view)] };

  const [rows, total, viewCounts, hidden] = await Promise.all([
    prisma.visitor.findMany({
      where,
      orderBy: { lastSeenAt: "desc" },
      skip: (params.page - 1) * VISITOR_PAGE_SIZE,
      take: VISITOR_PAGE_SIZE,
      select: visitorRowSelect,
    }),
    prisma.visitor.count({ where }),
    Promise.all(VISITOR_VIEWS.map((v) => prisma.visitor.count({ where: { AND: [...base, viewWhere(v)] } }))),
    params.all ? Promise.resolve(0) : prisma.visitor.count({ where: { OR: [{ isBot: true }, { isInternal: true }] } }),
  ]);
  return {
    rows,
    total,
    pageCount: Math.max(1, Math.ceil(total / VISITOR_PAGE_SIZE)),
    viewCounts: Object.fromEntries(VISITOR_VIEWS.map((v, i) => [v, viewCounts[i]])) as Record<VisitorView, number>,
    hidden,
  };
}

/** One visitor: profile, every visit with its activity (newest visit first), orders, signups, and other devices with the same email. */
export async function getVisitor(id: string) {
  await requireAdmin();
  const visitor = await prisma.visitor.findUnique({
    where: { id },
    include: {
      sessions: {
        orderBy: { startedAt: "desc" },
        take: 50,
        include: { events: { orderBy: { createdAt: "asc" }, take: 300 } },
      },
      orders: { orderBy: { createdAt: "desc" }, select: { id: true, number: true, status: true, totalCents: true, createdAt: true, paymentMethod: true } },
      subscribers: { select: { id: true, email: true, createdAt: true } },
      _count: { select: { sessions: true, events: true, pushSubscriptions: true } },
    },
  });
  if (!visitor) return null;
  const otherDevices = visitor.email
    ? await prisma.visitor.findMany({
        where: { email: visitor.email, id: { not: visitor.id } },
        orderBy: { lastSeenAt: "desc" },
        take: 10,
        select: { id: true, device: true, browser: true, os: true, city: true, region: true, country: true, lastSeenAt: true, appInstalledAt: true },
      })
    : [];
  return { ...visitor, otherDevices };
}

export type VisitorDetail = NonNullable<Awaited<ReturnType<typeof getVisitor>>>;
