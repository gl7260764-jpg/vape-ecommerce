import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarBlankIcon, DownloadSimpleIcon, EnvelopeSimpleIcon, FingerprintIcon, MagnifyingGlassIcon, ReceiptIcon } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { deleteSubscriber } from "@/app/actions/admin/subscribers";
import { AddSubscriber } from "@/components/admin/subscribers/add-subscriber";
import { ConfirmDelete } from "@/components/admin/ui/confirm-delete";
import { BUTTON, Card, EmptyState, MobileList, PageHeader, Pagination, StatTile, StatusPill, Table, Td, Th, type Tone } from "@/components/admin/ui/primitives";
import { SearchBox } from "@/components/admin/ui/search-box";
import { ListSkeleton } from "@/components/admin/ui/skeletons";
import { can, requireAdminPage } from "@/lib/admin/auth";
import { formatDate } from "@/lib/admin/format";
import { listSubscribers, parseSubscriberParams, SUBSCRIBER_PAGE_SIZE, subscriberQuery, type SubscriberRow, type SubscriberView } from "@/lib/admin/queries/subscribers";
import { CHANNEL_LABELS, placeLabel } from "@/lib/analytics/labels";
import { formatPrice } from "@/lib/catalog";

export const metadata: Metadata = { title: "Subscribers" };

const TILES: { view: SubscriberView; label: string; icon: Icon; tone: Tone }[] = [
  { view: "all", label: "All subscribers", icon: EnvelopeSimpleIcon, tone: "neutral" },
  { view: "recent", label: "Joined in the last 30 days", icon: CalendarBlankIcon, tone: "info" },
  { view: "customers", label: "Have placed an order", icon: ReceiptIcon, tone: "success" },
  { view: "tracked", label: "Linked to a visitor", icon: FingerprintIcon, tone: "brand" },
];

const href = (q: string) => (q ? `/admin/subscribers?${q}` : "/admin/subscribers");

function VisitorCell({ r }: { r: SubscriberRow }) {
  if (!r.visitor) return <span className="text-muted-foreground">Not linked</span>;
  return (
    <Link href={`/admin/analytics/visitors/${r.visitor.id}`} className="block hover:text-primary-ink">
      <span className="block">{placeLabel(r.visitor) ?? "Location unknown"}</span>
      <span className="block text-xs text-muted-foreground">
        From {r.visitor.firstSource ?? "Direct"}
        {r.visitor.firstChannel && r.visitor.firstSource !== CHANNEL_LABELS[r.visitor.firstChannel] ? ` (${CHANNEL_LABELS[r.visitor.firstChannel]})` : ""} · {r.visitor.sessionCount}{" "}
        {r.visitor.sessionCount === 1 ? "visit" : "visits"}
      </span>
    </Link>
  );
}

async function SubscribersView({ searchParams }: Pick<PageProps<"/admin/subscribers">, "searchParams">) {
  const params = parseSubscriberParams(await searchParams);
  const admin = await requireAdminPage();
  const data = await listSubscribers(params);
  const canManage = can(admin.role, "people:manage");
  const filtered = Boolean(params.q || params.view !== "all");
  const exportQuery = subscriberQuery(params, { page: 1 });

  return (
    <>
      <PageHeader
        eyebrow="Marketing"
        title="Subscribers"
        description="People who joined the email list. Linked visitors show where they came from and what they browsed."
        actions={
          canManage && data.total > 0 ? (
            <a href={`/admin/api/subscribers/export${exportQuery ? `?${exportQuery}` : ""}`} className={BUTTON.secondary} download>
              <DownloadSimpleIcon className="size-4" aria-hidden />
              Export {filtered ? `${data.total.toLocaleString("en-AU")} shown` : "CSV"}
            </a>
          ) : undefined
        }
      />

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TILES.map((t) => (
          <StatTile
            key={t.view}
            label={t.label}
            value={data.counts[t.view]}
            icon={t.icon}
            tone={params.view === t.view ? "brand" : t.tone}
            active={params.view === t.view}
            href={href(subscriberQuery(params, { view: t.view }))}
          />
        ))}
      </div>

      <Card className="mt-6">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-start lg:justify-between">
          <SearchBox placeholder="Search by email" className="lg:w-80" />
          <AddSubscriber />
        </div>

        {data.rows.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={MagnifyingGlassIcon}
              title="Nobody matches"
              description="No subscribers fit this search and filter."
              action={
                <Link href="/admin/subscribers" className={BUTTON.secondary}>
                  Clear filters
                </Link>
              }
            />
          ) : (
            <EmptyState icon={EnvelopeSimpleIcon} title="No subscribers yet" description="When someone joins from the store's footer, they appear here. You can also add people by hand above." />
          )
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Email</Th>
                  <Th>Joined</Th>
                  <Th>Visitor</Th>
                  <Th>Customer</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.rows.map((r) => (
                  <tr key={r.id} className="group transition-colors hover:bg-surface-2/40">
                    <Td>
                      <span className="block font-medium">{r.email}</span>
                      <span className="block text-xs text-muted-foreground">{r.source === "admin" ? "Added by the team" : r.source === "popup" ? "Signed up from the pop-up" : "Signed up on the store"}</span>
                    </Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{formatDate(r.createdAt)}</Td>
                    <Td>
                      <VisitorCell r={r} />
                    </Td>
                    <Td>
                      {r.orders.orders > 0 ? (
                        <span className="flex flex-col items-start gap-1">
                          <StatusPill tone="success" label={`${r.orders.orders} ${r.orders.orders === 1 ? "order" : "orders"}`} />
                          <span className="text-xs text-muted-foreground tabular-nums">{formatPrice(r.orders.totalCents / 100)}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">No orders</span>
                      )}
                    </Td>
                    <Td>
                      {canManage && (
                        <div className="flex justify-end opacity-60 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                          <ConfirmDelete name={r.email} kind="subscriber" action={deleteSubscriber.bind(null, r.id)} />
                        </div>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <MobileList>
              {data.rows.map((r) => (
                <li key={r.id}>
                  <div className="px-4 pt-4 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 font-medium break-all">{r.email}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
                    </div>
                    <div className="mt-2 text-sm">
                      <VisitorCell r={r} />
                    </div>
                    {r.orders.orders > 0 && (
                      <div className="mt-2">
                        <StatusPill tone="success" label={`${r.orders.orders} ${r.orders.orders === 1 ? "order" : "orders"} · ${formatPrice(r.orders.totalCents / 100)}`} />
                      </div>
                    )}
                  </div>
                  <div className="flex divide-x divide-border border-t border-border">
                    {r.visitor && (
                      <Link href={`/admin/analytics/visitors/${r.visitor.id}`} className="flex min-h-11 flex-1 items-center justify-center gap-2 text-sm font-medium hover:bg-surface-2/50">
                        <FingerprintIcon className="size-4" aria-hidden /> Visitor history
                      </Link>
                    )}
                    {canManage && <ConfirmDelete name={r.email} kind="subscriber" action={deleteSubscriber.bind(null, r.id)} variant="bar" />}
                  </div>
                </li>
              ))}
            </MobileList>

            <Pagination page={params.page} pageCount={data.pageCount} total={data.total} pageSize={SUBSCRIBER_PAGE_SIZE} href={(page) => href(subscriberQuery(params, { page }))} />
          </>
        )}
      </Card>
      <p className="mt-4 text-xs text-muted-foreground">
        No emails are sent from here yet. Exports follow the current search and filter.
      </p>
    </>
  );
}

export default function SubscribersPage({ searchParams }: PageProps<"/admin/subscribers">) {
  return (
    <Suspense fallback={<ListSkeleton tiles={4} />}>
      <SubscribersView searchParams={searchParams} />
    </Suspense>
  );
}
