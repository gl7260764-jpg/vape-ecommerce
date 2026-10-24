import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowsClockwiseIcon, EnvelopeSimpleIcon, MagnifyingGlassIcon, ReceiptIcon, SparkleIcon, UsersThreeIcon } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { VisitorTable } from "@/components/admin/analytics/visitor-table";
import { BUTTON, Card, Chip, EmptyState, PageHeader, Pagination, StatTile, type Tone } from "@/components/admin/ui/primitives";
import { SearchBox } from "@/components/admin/ui/search-box";
import { ListSkeleton } from "@/components/admin/ui/skeletons";
import { UrlSelect } from "@/components/admin/ui/url-select";
import { listVisitors, parseVisitorParams, VISITOR_PAGE_SIZE, visitorListHref, type VisitorView } from "@/lib/admin/queries/visitors";
import { CHANNEL_LABELS, CHANNELS, countryName } from "@/lib/analytics/labels";
import { prisma } from "@/lib/db";
import { requireAdmin, requireAdminPage } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Visitors" };

const TILES: { view: VisitorView; label: string; icon: Icon; tone: Tone }[] = [
  { view: "all", label: "All visitors", icon: UsersThreeIcon, tone: "neutral" },
  { view: "new", label: "New today", icon: SparkleIcon, tone: "info" },
  { view: "returning", label: "Came back", icon: ArrowsClockwiseIcon, tone: "info" },
  { view: "identified", label: "Known email", icon: EnvelopeSimpleIcon, tone: "brand" },
  { view: "customers", label: "Placed an order", icon: ReceiptIcon, tone: "success" },
];

async function countryOptions() {
  await requireAdmin();
  const rows = await prisma.visitor.groupBy({ by: ["country"], where: { country: { not: null } }, _count: { _all: true } });
  return rows
    .sort((a, b) => b._count._all - a._count._all)
    .map((r) => ({ value: r.country!, label: `${countryName(r.country)} (${r._count._all})` }));
}

async function VisitorsView({ searchParams }: Pick<PageProps<"/admin/analytics/visitors">, "searchParams">) {
  await requireAdminPage();
  const params = parseVisitorParams(await searchParams);
  const [data, countries] = await Promise.all([listVisitors(params), countryOptions()]);
  const filtered = Boolean(params.q || params.channel || params.country || params.view !== "all");

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/admin/analytics" className="hover:text-foreground">
            Analytics
          </Link>
        }
        title="Visitors"
        description="Everyone who has opened the store, newest activity first. Open a visitor to see everything they did."
      />

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {TILES.map((t) => (
          <StatTile
            key={t.view}
            label={t.label}
            value={data.viewCounts[t.view]}
            icon={t.icon}
            tone={params.view === t.view ? "brand" : t.tone}
            active={params.view === t.view}
            href={visitorListHref(params, { view: t.view })}
          />
        ))}
      </div>

      <Card className="mt-6">
        <div className="grid grid-cols-1 gap-3 border-b border-border p-4 md:grid-cols-[minmax(0,1.6fr)_repeat(2,minmax(0,1fr))]">
          <SearchBox placeholder="Search email, city, IP or country code" />
          <UrlSelect name="channel" label="Came from" allLabel="All channels" options={CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABELS[c] }))} />
          <UrlSelect name="country" label="Country" allLabel="All countries" options={countries} />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 text-sm text-muted-foreground">
          <Chip href={visitorListHref(params, { all: !params.all })} active={params.all}>
            {params.all ? "Including bots and team" : "Hiding bots and team"}
          </Chip>
          {!params.all && data.hidden > 0 && <span>{data.hidden.toLocaleString("en-AU")} hidden</span>}
        </div>

        {data.rows.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={MagnifyingGlassIcon}
              title="Nobody matches"
              description="No visitors fit this search and these filters."
              action={
                <Link href="/admin/analytics/visitors" className={BUTTON.secondary}>
                  Clear filters
                </Link>
              }
            />
          ) : (
            <EmptyState icon={UsersThreeIcon} title="No visitors yet" description="As soon as someone opens the store, they appear here." />
          )
        ) : (
          <>
            <VisitorTable rows={data.rows} />
            <Pagination page={params.page} pageCount={data.pageCount} total={data.total} pageSize={VISITOR_PAGE_SIZE} href={(page) => visitorListHref(params, { page })} />
          </>
        )}
      </Card>
    </>
  );
}

export default function VisitorsPage({ searchParams }: PageProps<"/admin/analytics/visitors">) {
  return (
    <Suspense fallback={<ListSkeleton tiles={4} />}>
      <VisitorsView searchParams={searchParams} />
    </Suspense>
  );
}
