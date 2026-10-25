import "server-only";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/auth";
import { dayKey, hourKey, storeDayStart, STORE_TZ } from "@/lib/admin/time";
import type { Prisma } from "@/generated/prisma/client";

// Every analytics panel takes the same window + filter, so all numbers on the page agree.

export const PERIODS = [
  { value: "today", label: "Today", days: 1 },
  { value: "7d", label: "7 days", days: 7 },
  { value: "30d", label: "30 days", days: 30 },
  { value: "90d", label: "90 days", days: 90 },
] as const;
export type Period = (typeof PERIODS)[number]["value"];

export type AnalyticsParams = { period: Period; all: boolean };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseAnalyticsParams(sp: Record<string, string | string[] | undefined>): AnalyticsParams {
  const period = first(sp.period);
  return { period: PERIODS.some((p) => p.value === period) ? (period as Period) : "7d", all: first(sp.all) === "1" };
}

export function analyticsHref(base: string, params: AnalyticsParams, change: Partial<AnalyticsParams>) {
  const next = { ...params, ...change };
  const qs = new URLSearchParams();
  if (next.period !== "7d") qs.set("period", next.period);
  if (next.all) qs.set("all", "1");
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

export type Window = { start: Date; end: Date; prevStart: Date; prevEnd: Date; bucket: "hour" | "day"; keys: string[] };

/** The period as instants, plus the equal-length window before it and every chart bucket (zeros included). */
export function periodWindow(period: Period, now = new Date()): Window {
  const days = PERIODS.find((p) => p.value === period)!.days;
  const start = storeDayStart(days - 1, now);
  const end = now;
  const span = end.getTime() - start.getTime();
  const keys: string[] = [];
  if (period === "today") {
    for (let t = start.getTime(); t <= end.getTime(); t += 3_600_000) keys.push(hourKey(new Date(t)));
  } else {
    for (let i = days - 1; i >= 0; i--) keys.push(dayKey(storeDayStart(i, now)));
  }
  return { start, end, prevStart: new Date(start.getTime() - span), prevEnd: start, bucket: period === "today" ? "hour" : "day", keys: [...new Set(keys)] };
}

/** Bots and the team's own browsing are hidden unless "all" is on. */
const visitorScope = (all: boolean): Prisma.VisitorWhereInput => (all ? {} : { isBot: false, isInternal: false });

// ---------------------------------------------------------------------------
// Live strip
// ---------------------------------------------------------------------------

export async function liveStats(all: boolean) {
  await requireAdmin();
  const scope = visitorScope(all);
  const today = storeDayStart(0);
  const yesterday = storeDayStart(1);
  const distinct = (from: Date, to?: Date) =>
    prisma.visitorSession
      .groupBy({ by: ["visitorId"], where: { startedAt: { gte: from, ...(to ? { lt: to } : {}) }, visitor: scope } })
      .then((r) => r.length);
  const [online, todayCount, yesterdayCount, allTime] = await Promise.all([
    prisma.visitorSession.count({ where: { lastSeenAt: { gte: new Date(Date.now() - 5 * 60_000) }, visitor: scope } }),
    distinct(today),
    distinct(yesterday, today),
    prisma.visitor.count({ where: scope }),
  ]);
  return { online, today: todayCount, yesterday: yesterdayCount, allTime };
}

// ---------------------------------------------------------------------------
// KPIs, each with the previous equal-length window for a delta
// ---------------------------------------------------------------------------

async function windowTotals(from: Date, to: Date, all: boolean) {
  const scope = visitorScope(all);
  const sessionWhere: Prisma.VisitorSessionWhereInput = { startedAt: { gte: from, lt: to }, visitor: scope };
  const [visitors, visits, pageviews, orders] = await Promise.all([
    prisma.$queryRaw<{ n: number }[]>`
      SELECT count(DISTINCT s."visitorId")::int AS n
      FROM "VisitorSession" s JOIN "Visitor" v ON v.id = s."visitorId"
      WHERE s."startedAt" >= ${from} AND s."startedAt" < ${to}
        AND (${all} OR (v."isBot" = false AND v."isInternal" = false))`.then((r) => r[0]?.n ?? 0),
    prisma.visitorSession.count({ where: sessionWhere }),
    prisma.visitorEvent.count({ where: { type: "page_view", createdAt: { gte: from, lt: to }, visitor: scope } }),
    prisma.order.count({
      where: { createdAt: { gte: from, lt: to }, status: { not: "cancelled" }, ...(all ? {} : { OR: [{ visitorId: null }, { visitor: scope }] }) },
    }),
  ]);
  return { visitors, visits, pageviews, orders };
}

export async function kpis(w: Window, all: boolean) {
  await requireAdmin();
  const [now, prev] = await Promise.all([windowTotals(w.start, w.end, all), windowTotals(w.prevStart, w.prevEnd, all)]);
  const ratio = (a: number, b: number) => (b ? a / b : 0);
  return {
    current: { ...now, pagesPerVisit: ratio(now.pageviews, now.visits), conversion: ratio(now.orders, now.visitors) },
    previous: { ...prev, pagesPerVisit: ratio(prev.pageviews, prev.visits), conversion: ratio(prev.orders, prev.visitors) },
  };
}

// ---------------------------------------------------------------------------
// Traffic over time
// ---------------------------------------------------------------------------

export type SeriesPoint = { key: string; visitors: number; visits: number; pageviews: number };

export async function trafficSeries(w: Window, all: boolean): Promise<SeriesPoint[]> {
  await requireAdmin();
  const fmt = w.bucket === "hour" ? "YYYY-MM-DD HH24" : "YYYY-MM-DD";
  const [sessions, views] = await Promise.all([
    prisma.$queryRaw<{ k: string; visitors: number; visits: number }[]>`
      SELECT to_char((s."startedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${STORE_TZ}, ${fmt}) AS k,
             count(DISTINCT s."visitorId")::int AS visitors, count(*)::int AS visits
      FROM "VisitorSession" s JOIN "Visitor" v ON v.id = s."visitorId"
      WHERE s."startedAt" >= ${w.start} AND s."startedAt" < ${w.end}
        AND (${all} OR (v."isBot" = false AND v."isInternal" = false))
      GROUP BY 1`,
    prisma.$queryRaw<{ k: string; pageviews: number }[]>`
      SELECT to_char((e."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${STORE_TZ}, ${fmt}) AS k, count(*)::int AS pageviews
      FROM "VisitorEvent" e JOIN "Visitor" v ON v.id = e."visitorId"
      WHERE e.type = 'page_view' AND e."createdAt" >= ${w.start} AND e."createdAt" < ${w.end}
        AND (${all} OR (v."isBot" = false AND v."isInternal" = false))
      GROUP BY 1`,
  ]);
  const s = new Map(sessions.map((r) => [r.k, r]));
  const v = new Map(views.map((r) => [r.k, r.pageviews]));
  // Every bucket, including empty ones, so a quiet day shows as zero rather than vanishing.
  return w.keys.map((key) => ({ key, visitors: s.get(key)?.visitors ?? 0, visits: s.get(key)?.visits ?? 0, pageviews: v.get(key) ?? 0 }));
}

// ---------------------------------------------------------------------------
// Breakdowns (counted in visits: each visit has its own source, place and device)
// ---------------------------------------------------------------------------

export type Row = { key: string; label: string; value: number; sub?: string };
type Dim = "source" | "channel" | "country" | "device" | "browser" | "os" | "landingPath";

export async function breakdown(dim: Dim, w: Window, all: boolean, take = 8): Promise<{ rows: { key: string | null; value: number }[]; total: number; distinct: number }> {
  await requireAdmin();
  const groups = await prisma.visitorSession.groupBy({
    by: [dim],
    where: { startedAt: { gte: w.start, lt: w.end }, visitor: visitorScope(all) },
    _count: { _all: true },
  });
  const sorted = groups.map((g) => ({ key: (g[dim] as string | null) ?? null, value: g._count._all })).sort((a, b) => b.value - a.value);
  return { rows: sorted.slice(0, take), total: sorted.reduce((n, r) => n + r.value, 0), distinct: sorted.length };
}

/** States and provinces, labelled with their country so "Victoria" can't be confused across countries. */
export async function regions(w: Window, all: boolean, take = 8) {
  await requireAdmin();
  const groups = await prisma.visitorSession.groupBy({
    by: ["country", "region"],
    where: { startedAt: { gte: w.start, lt: w.end }, visitor: visitorScope(all), region: { not: null } },
    _count: { _all: true },
  });
  const sorted = groups.map((g) => ({ country: g.country, region: g.region!, value: g._count._all })).sort((a, b) => b.value - a.value);
  return { rows: sorted.slice(0, take), total: sorted.reduce((n, r) => n + r.value, 0), distinct: sorted.length };
}

export async function topPages(w: Window, all: boolean, take = 10) {
  await requireAdmin();
  const rows = await prisma.$queryRaw<{ path: string; views: number; visitors: number; title: string | null }[]>`
    SELECT e.path, count(*)::int AS views, count(DISTINCT e."visitorId")::int AS visitors,
           (array_agg(e.title ORDER BY e."createdAt" DESC))[1] AS title
    FROM "VisitorEvent" e JOIN "Visitor" v ON v.id = e."visitorId"
    WHERE e.type = 'page_view' AND e."createdAt" >= ${w.start} AND e."createdAt" < ${w.end}
      AND (${all} OR (v."isBot" = false AND v."isInternal" = false))
    GROUP BY e.path ORDER BY views DESC LIMIT ${take}`;
  return rows;
}

/** Distinct visitors reaching each step of the shopping funnel in the window. */
export async function funnel(w: Window, all: boolean) {
  await requireAdmin();
  const [r] = await prisma.$queryRaw<{ visitors: number; carted: number; checkout: number; ordered: number }[]>`
    SELECT count(DISTINCT e."visitorId")::int AS visitors,
           count(DISTINCT CASE WHEN e.type = 'add_to_cart' THEN e."visitorId" END)::int AS carted,
           count(DISTINCT CASE WHEN e.type = 'begin_checkout' THEN e."visitorId" END)::int AS checkout,
           count(DISTINCT CASE WHEN e.type = 'place_order' THEN e."visitorId" END)::int AS ordered
    FROM "VisitorEvent" e JOIN "Visitor" v ON v.id = e."visitorId"
    WHERE e."createdAt" >= ${w.start} AND e."createdAt" < ${w.end}
      AND (${all} OR (v."isBot" = false AND v."isInternal" = false))`;
  return r ?? { visitors: 0, carted: 0, checkout: 0, ordered: 0 };
}

/** The latest things people did, newest first, across all visitors. */
export async function recentActivity(all: boolean, take = 15) {
  await requireAdmin();
  return prisma.visitorEvent.findMany({
    where: { type: { not: "page_view" }, visitor: visitorScope(all) },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      type: true,
      path: true,
      title: true,
      label: true,
      value: true,
      createdAt: true,
      visitor: { select: { id: true, email: true, city: true, region: true, country: true } },
    },
  });
}

/** Visitors seen most recently, for the overview's "latest visitors" table. */
export async function latestVisitors(all: boolean, take = 8) {
  await requireAdmin();
  return prisma.visitor.findMany({
    where: visitorScope(all),
    orderBy: { lastSeenAt: "desc" },
    take,
    select: visitorRowSelect,
  });
}

export const visitorRowSelect = {
  id: true,
  email: true,
  city: true,
  region: true,
  country: true,
  device: true,
  browser: true,
  os: true,
  firstSource: true,
  firstChannel: true,
  firstSeenAt: true,
  lastSeenAt: true,
  sessionCount: true,
  pageviewCount: true,
  isBot: true,
  isInternal: true,
  appInstalledAt: true,
  appPlatform: true,
  _count: { select: { orders: true, subscribers: true, pushSubscriptions: true } },
} satisfies Prisma.VisitorSelect;

export type VisitorRow = Prisma.VisitorGetPayload<{ select: typeof visitorRowSelect }>;

/** How many visitors the default view hides (bots + the team), so the page can say so. */
export async function hiddenVisitorCount() {
  await requireAdmin();
  return prisma.visitor.count({ where: { OR: [{ isBot: true }, { isInternal: true }] } });
}
