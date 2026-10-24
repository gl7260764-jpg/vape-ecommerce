import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRightIcon, BrowserIcon, CursorIcon, EyeIcon, ReceiptIcon, UsersThreeIcon } from "@phosphor-icons/react/dist/ssr";
import { AnalyticsFilters, EventDot, Kpi } from "@/components/admin/analytics/parts";
import { VisitorTable, visitorName } from "@/components/admin/analytics/visitor-table";
import { BarList } from "@/components/admin/charts/bar-list";
import { ColumnChart, type ColumnPoint } from "@/components/admin/charts/column-chart";
import { BUTTON, Card, CardHeader, EmptyState, PageHeader } from "@/components/admin/ui/primitives";
import { ListSkeleton } from "@/components/admin/ui/skeletons";
import {
  breakdown,
  funnel,
  hiddenVisitorCount,
  kpis,
  latestVisitors,
  liveStats,
  parseAnalyticsParams,
  periodWindow,
  PERIODS,
  recentActivity,
  regions,
  topPages,
  trafficSeries,
  type SeriesPoint,
} from "@/lib/admin/queries/analytics";
import { requireAdminPage } from "@/lib/admin/auth";
import { timeAgo } from "@/lib/admin/time";
import { CHANNEL_LABELS, countryName, DEVICE_LABELS, EVENT_LABELS, pageTitle, placeLabel } from "@/lib/analytics/labels";
import { formatPrice } from "@/lib/catalog";
import type { TrafficChannel } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Analytics" };

const full = new Intl.NumberFormat("en-AU");
const pct = (n: number) => `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`;

/** Bucket keys from SQL ("2026-10-23" or "2026-10-23 14") as axis ticks and tooltip titles. */
function toPoints(series: SeriesPoint[], hourly: boolean): ColumnPoint[] {
  return series.map((p) => {
    const [date, hour] = p.key.split(" ");
    const [y, m, d] = date.split("-").map(Number);
    const at = new Date(Date.UTC(y, m - 1, d, hour ? Number(hour) : 12));
    const day = new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(at);
    const clock = new Intl.DateTimeFormat("en-AU", { hour: "numeric", timeZone: "UTC" }).format(at).replace(" ", "");
    return {
      key: p.key,
      tick: hourly ? clock : new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", timeZone: "UTC" }).format(at),
      title: hourly ? `${day}, ${clock}` : day,
      value: p.visitors,
      extra: [
        { label: "Visits", value: p.visits },
        { label: "Page views", value: p.pageviews },
      ],
    };
  });
}

async function Overview({ searchParams }: Pick<PageProps<"/admin/analytics">, "searchParams">) {
  await requireAdminPage(); // redirect a lapsed session before any loader runs
  const params = parseAnalyticsParams(await searchParams);
  const w = periodWindow(params.period);
  const periodLabel = PERIODS.find((p) => p.value === params.period)!.label.toLowerCase();

  const [live, k, series, sources, channels, countries, states, devices, browsers, oses, landing, pages, steps, activity, visitors, hidden] = await Promise.all([
    liveStats(params.all),
    kpis(w, params.all),
    trafficSeries(w, params.all),
    breakdown("source", w, params.all),
    breakdown("channel", w, params.all),
    breakdown("country", w, params.all),
    regions(w, params.all),
    breakdown("device", w, params.all),
    breakdown("browser", w, params.all),
    breakdown("os", w, params.all),
    breakdown("landingPath", w, params.all, 6),
    topPages(w, params.all),
    funnel(w, params.all),
    recentActivity(params.all),
    latestVisitors(params.all),
    hiddenVisitorCount(),
  ]);
  const c = k.current;
  const p = k.previous;
  const noTraffic = live.allTime === 0;
  const geoHelp = "Location comes from each visitor's IP address. A live host such as Vercel or Cloudflare fills it in automatically.";

  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="Analytics"
        description="Who visits the store, where they come from and what they do."
        actions={
          <Link href="/admin/analytics/visitors" className={BUTTON.secondary}>
            All visitors <ArrowRightIcon className="size-4" aria-hidden />
          </Link>
        }
      />

      <div className="mt-6">
        <AnalyticsFilters base="/admin/analytics" params={params} hidden={hidden} />
      </div>

      {/* Live strip */}
      <div className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
        <div className="flex items-center gap-3 bg-foreground px-5 py-4 text-background">
          <span className="relative flex size-3" aria-hidden>
            {live.online > 0 && <span className="absolute inline-flex size-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />}
            <span className={`relative inline-flex size-3 rounded-full ${live.online > 0 ? "bg-emerald-400" : "bg-background/40"}`} />
          </span>
          <div>
            <p className="text-2xl leading-none font-semibold">{full.format(live.online)}</p>
            <p className="mt-1 text-xs text-background/70">on the site now (last 5 min)</p>
          </div>
        </div>
        {[
          ["Visitors today", live.today],
          ["Yesterday", live.yesterday],
          ["All time", live.allTime],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface px-5 py-4">
            <p className="text-2xl leading-none font-semibold">{full.format(value as number)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {noTraffic ? (
        <Card className="mt-6">
          <EmptyState
            icon={UsersThreeIcon}
            title="No visitors recorded yet"
            description="Tracking is on. As soon as someone opens the store, their visit shows up here, usually within a second."
          />
        </Card>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi label="Visitors" icon={UsersThreeIcon} value={c.visitors} previous={p.visitors} />
            <Kpi label="Visits" icon={CursorIcon} value={c.visits} previous={p.visits} />
            <Kpi label="Page views" icon={EyeIcon} value={c.pageviews} previous={p.pageviews} />
            <Kpi label="Pages per visit" icon={BrowserIcon} value={c.pagesPerVisit} previous={p.pagesPerVisit} format={(n) => n.toFixed(1)} />
            <Kpi label="Orders placed" icon={ReceiptIcon} value={c.orders} previous={p.orders} hint={`${pct(c.conversion)} of visitors`} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Changes compare with the {periodLabel === "today" ? "same hours yesterday" : `previous ${periodLabel}`}.</p>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title={params.period === "today" ? "Visitors per hour" : "Visitors per day"} description="Unique visitors. Hover a column for visits and page views." />
              <div className="p-5">
                <ColumnChart points={toPoints(series, w.bucket === "hour")} valueLabel="Visitors" />
              </div>
            </Card>

            <Card>
              <CardHeader title="Shopping funnel" description="Visitors who reached each step" />
              <div className="p-5">
                <BarList
                  base={steps.visitors}
                  empty="No shopping activity in this period."
                  valueLabel="visitors"
                  rows={[
                    { key: "visited", label: "Visited the store", value: steps.visitors },
                    { key: "carted", label: "Added to cart", value: steps.carted },
                    { key: "checkout", label: "Started checkout", value: steps.checkout },
                    { key: "ordered", label: "Placed an order", value: steps.ordered },
                  ]}
                />
              </div>
            </Card>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader title="Where visits come from" description="Google, ChatGPT, Facebook and other sources" />
              <div className="p-5">
                <BarList
                  rows={sources.rows.map((r) => ({ key: r.key ?? "direct", label: r.key ?? "Direct", value: r.value }))}
                  total={sources.total}
                  distinct={sources.distinct}
                  empty="No visits in this period."
                />
              </div>
            </Card>
            <Card>
              <CardHeader title="Channels" description="Each source grouped by kind" />
              <div className="p-5">
                <BarList
                  rows={channels.rows.map((r) => ({
                    key: r.key ?? "direct",
                    label: CHANNEL_LABELS[(r.key ?? "direct") as TrafficChannel],
                    value: r.value,
                    href: `/admin/analytics/visitors?channel=${r.key}`,
                  }))}
                  total={channels.total}
                  empty="No visits in this period."
                />
              </div>
            </Card>
            <Card>
              <CardHeader title="Countries" />
              <div className="p-5">
                <BarList
                  rows={countries.rows.map((r) => ({
                    key: r.key ?? "unknown",
                    label: countryName(r.key) ?? "Unknown",
                    value: r.value,
                    href: r.key ? `/admin/analytics/visitors?country=${r.key}` : undefined,
                  }))}
                  total={countries.total}
                  distinct={countries.distinct}
                  empty={geoHelp}
                />
              </div>
            </Card>
            <Card>
              <CardHeader title="States and regions" />
              <div className="p-5">
                <BarList
                  rows={states.rows.map((r) => ({ key: `${r.country}-${r.region}`, label: r.region, sub: countryName(r.country) ?? undefined, value: r.value }))}
                  total={states.total}
                  distinct={states.distinct}
                  empty={geoHelp}
                />
              </div>
            </Card>
            <Card>
              <CardHeader title="Most viewed pages" />
              <div className="p-5">
                <BarList
                  valueLabel="page views"
                  rows={pages.map((r) => ({
                    key: r.path,
                    label: (
                      <a href={r.path} target="_blank" rel="noreferrer" className="hover:text-primary-ink">
                        {pageTitle(r.title) ?? r.path}
                      </a>
                    ),
                    sub: `${full.format(r.visitors)} ${r.visitors === 1 ? "visitor" : "visitors"}`,
                    value: r.views,
                  }))}
                  base={c.pageviews}
                  empty="No page views in this period."
                />
              </div>
            </Card>
            <Card>
              <CardHeader title="Landing pages" description="The first page of each visit" />
              <div className="p-5">
                <BarList rows={landing.rows.map((r) => ({ key: r.key ?? "-", label: r.key ?? "-", value: r.value }))} total={landing.total} distinct={landing.distinct} empty="No visits in this period." />
              </div>
            </Card>
            <Card>
              <CardHeader title="Devices" />
              <div className="p-5">
                <BarList rows={devices.rows.map((r) => ({ key: r.key ?? "unknown", label: DEVICE_LABELS[r.key ?? ""] ?? "Unknown", value: r.value }))} total={devices.total} empty="No visits in this period." />
              </div>
            </Card>
            <Card>
              <CardHeader title="Browsers" />
              <div className="p-5">
                <BarList rows={browsers.rows.map((r) => ({ key: r.key ?? "unknown", label: r.key ?? "Unknown", value: r.value }))} total={browsers.total} distinct={browsers.distinct} empty="No visits in this period." />
              </div>
            </Card>
            <Card>
              <CardHeader title="Operating systems" />
              <div className="p-5">
                <BarList rows={oses.rows.map((r) => ({ key: r.key ?? "unknown", label: r.key ?? "Unknown", value: r.value }))} total={oses.total} distinct={oses.distinct} empty="No visits in this period." />
              </div>
            </Card>
          </div>
        </>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 2xl:grid-cols-5">
        <Card className="2xl:col-span-2">
          <CardHeader title="Recent shopper activity" description="Carts, searches, checkouts, orders and signups" />
          {activity.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">Nothing yet. Adding to cart, searching and checking out appear here.</p>
          ) : (
            <ol className="divide-y divide-border">
              {activity.map((e) => (
                <li key={e.id}>
                  <Link href={`/admin/analytics/visitors/${e.visitor.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-surface-2/40">
                    <EventDot type={e.type} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm">
                        <span className="font-medium">{EVENT_LABELS[e.type]}</span>
                        {e.label && <span className="text-muted-foreground"> · {e.label}</span>}
                        {e.value ? <span className="text-muted-foreground"> · {formatPrice(e.value / 100)}</span> : null}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {visitorName(e.visitor)}
                        {/* Anonymous names already say where they're from; known emails get the place appended. */}
                        {e.visitor.email && placeLabel(e.visitor, false) ? ` · ${placeLabel(e.visitor, false)}` : ""}
                      </span>
                    </span>
                    <time dateTime={e.createdAt.toISOString()} className="shrink-0 text-xs text-muted-foreground">
                      {timeAgo(e.createdAt)}
                    </time>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card className="2xl:col-span-3">
          <CardHeader
            title="Latest visitors"
            action={
              <Link href="/admin/analytics/visitors" className="group inline-flex items-center gap-1 text-sm font-medium text-primary-ink">
                View all <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            }
          />
          {visitors.length ? <VisitorTable rows={visitors} /> : <p className="p-5 text-sm text-muted-foreground">No visitors yet.</p>}
        </Card>
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Times are Sydney time. Bots and the team&apos;s own browsing are left out unless you include them. IP geolocation by{" "}
        <a href="https://db-ip.com" target="_blank" rel="noreferrer" className="underline">
          DB-IP
        </a>
        .
      </p>
    </>
  );
}

export default function AnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  return (
    <Suspense fallback={<ListSkeleton tiles={4} />}>
      <Overview searchParams={searchParams} />
    </Suspense>
  );
}
