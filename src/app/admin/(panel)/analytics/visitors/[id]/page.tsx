import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CaretDownIcon, DevicesIcon, GlobeIcon, IdentificationCardIcon, SignpostIcon } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { DeviceIcon, EventDot } from "@/components/admin/analytics/parts";
import { visitorName } from "@/components/admin/analytics/visitor-table";
import { Card, PageHeader, StatusPill } from "@/components/admin/ui/primitives";
import { EditorSkeleton } from "@/components/admin/ui/skeletons";
import { requireAdminPage } from "@/lib/admin/auth";
import { formatDateTime } from "@/lib/admin/format";
import { getVisitor, type VisitorDetail } from "@/lib/admin/queries/visitors";
import { formatDuration, STORE_TZ, timeAgo } from "@/lib/admin/time";
import { CHANNEL_LABELS, DEVICE_LABELS, EVENT_LABELS, pageTitle, placeLabel } from "@/lib/analytics/labels";
import { formatPrice } from "@/lib/catalog";
import { orderNumber, paymentLabel } from "@/lib/checkout";

export const metadata: Metadata = { title: "Visitor" };

const clock = new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", timeZone: STORE_TZ });
const ORDER_TONE = { pending_payment: "warning", paid: "success", processing: "info", shipped: "info", delivered: "success", cancelled: "danger" } as const;
const ORDER_LABEL = { pending_payment: "Awaiting payment", paid: "Paid", processing: "Processing", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled" } as const;

function Facts({ title, icon: IconComp, rows }: { title: string; icon: Icon; rows: [string, React.ReactNode][] }) {
  const shown = rows.filter(([, v]) => v !== null && v !== undefined && v !== "");
  return (
    <Card>
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <IconComp className="size-4 text-muted-foreground" aria-hidden />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <dl className="grid gap-3 p-5 text-sm">
        {shown.length === 0 && <p className="text-muted-foreground">Nothing known yet.</p>}
        {shown.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="min-w-0 break-words">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function Timeline({ v }: { v: VisitorDetail }) {
  return (
    <ol className="flex flex-col gap-4">
      {v.sessions.map((s, i) => {
        const duration = s.lastSeenAt.getTime() - s.startedAt.getTime();
        return (
          <li key={s.id}>
            <details open={i === 0} className="group rounded-2xl border border-border bg-surface">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    Visit {v._count.sessions - i} · {formatDateTime(s.startedAt)}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    From <span className="font-medium text-foreground">{s.source}</span> ({CHANNEL_LABELS[s.channel]}) · landed on {s.landingPath}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {s.pageviews} {s.pageviews === 1 ? "page" : "pages"} · {formatDuration(duration)}
                </span>
                <CaretDownIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <ol className="relative border-t border-border px-5 py-4 before:absolute before:top-6 before:bottom-6 before:left-[2.25rem] before:w-px before:bg-border">
                {s.events.map((e) => (
                  <li key={e.id} className="relative flex items-start gap-3 py-2">
                    <EventDot type={e.type} />
                    <div className="min-w-0 flex-1 pt-1">
                      <p className="text-sm">
                        <span className="font-medium">{EVENT_LABELS[e.type]}</span>
                        {e.type === "page_view" ? (
                          <>
                            {" "}
                            <a href={e.path} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary-ink">
                              {pageTitle(e.title) ?? e.path}
                            </a>
                          </>
                        ) : (
                          <>
                            {e.label && <span className="text-muted-foreground"> · {e.label}</span>}
                            {e.value ? <span className="text-muted-foreground"> · {formatPrice(e.value / 100)}</span> : null}
                          </>
                        )}
                      </p>
                      {e.type === "page_view" && pageTitle(e.title) && <p className="truncate font-mono text-xs text-muted-foreground">{e.path}</p>}
                    </div>
                    <time dateTime={e.createdAt.toISOString()} className="shrink-0 pt-1 text-xs text-muted-foreground tabular-nums">
                      {clock.format(e.createdAt)}
                    </time>
                  </li>
                ))}
                {s.events.length === 0 && <li className="py-2 text-sm text-muted-foreground">No activity recorded.</li>}
              </ol>
            </details>
          </li>
        );
      })}
    </ol>
  );
}

async function VisitorView({ params }: Pick<PageProps<"/admin/analytics/visitors/[id]">, "params">) {
  await requireAdminPage();
  const { id } = await params;
  const v = await getVisitor(id);
  if (!v) notFound();

  const firstOrder = v.orders.at(-1);
  const daysToConvert = firstOrder ? Math.max(0, Math.round((firstOrder.createdAt.getTime() - v.firstSeenAt.getTime()) / 86_400_000)) : null;
  const subscribedAt = v.subscribers[0]?.createdAt;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/admin/analytics/visitors" className="hover:text-foreground">
            Visitors
          </Link>
        }
        title={visitorName(v)}
        titleClassName={v.email ? "font-sans text-xl font-semibold tracking-normal normal-case break-all md:text-2xl" : undefined}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {v.orders.length > 0 && <StatusPill tone="success" label={`${v.orders.length} ${v.orders.length === 1 ? "order" : "orders"}`} />}
            {subscribedAt && <StatusPill tone="brand" label="Subscriber" />}
            {v.sessionCount > 1 && <StatusPill tone="info" label="Returning" />}
            {v.isInternal && <StatusPill tone="neutral" label="Team" />}
            {v.isBot && <StatusPill tone="warning" label="Bot" />}
            <span>
              First seen {formatDateTime(v.firstSeenAt)} · last seen {timeAgo(v.lastSeenAt)}
            </span>
          </span>
        }
      />

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Visits", v.sessionCount],
          ["Pages viewed", v.pageviewCount],
          ["Actions", v._count.events],
          ["Days to first order", daysToConvert ?? "-"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-2xl leading-none font-semibold">{value}</p>
            <p className="mt-1.5 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-4">
          <Facts
            title="Who"
            icon={IdentificationCardIcon}
            rows={[
              ["Email", v.email ?? "Not known yet"],
              ["Known since", v.identifiedAt ? formatDateTime(v.identifiedAt) : null],
              ["Subscribed", subscribedAt ? formatDateTime(subscribedAt) : "No"],
              [
                "Orders",
                v.orders.length ? (
                  <ul className="grid gap-1.5">
                    {v.orders.map((o) => (
                      <li key={o.id} className="flex flex-wrap items-center gap-2">
                        <span className="font-mono">{orderNumber(o.number)}</span>
                        <span className="tabular-nums">{formatPrice(o.totalCents / 100)}</span>
                        <StatusPill tone={ORDER_TONE[o.status]} label={ORDER_LABEL[o.status]} />
                        <span className="w-full text-xs text-muted-foreground">
                          {formatDateTime(o.createdAt)} · {paymentLabel(o.paymentMethod)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  "None yet"
                ),
              ],
            ]}
          />
          <Facts
            title="How they found the store"
            icon={SignpostIcon}
            rows={[
              ["Source", v.firstSource ?? "Direct"],
              ["Channel", v.firstChannel ? CHANNEL_LABELS[v.firstChannel] : null],
              [
                "Referring page",
                v.firstReferrer ? (
                  <a href={v.firstReferrer} target="_blank" rel="noreferrer noopener" className="break-all text-primary-ink hover:underline">
                    {v.firstReferrer}
                  </a>
                ) : null,
              ],
              ["First page", v.firstLanding ? <span className="font-mono text-xs">{v.firstLanding}</span> : null],
              ["Campaign", [v.firstUtmSource, v.firstUtmMedium, v.firstUtmCampaign].filter(Boolean).join(" / ") || null],
            ]}
          />
          <Facts
            title="Where and on what"
            icon={GlobeIcon}
            rows={[
              ["Location", placeLabel(v) ?? "Unknown"],
              ["IP address", v.ip ? <span className="font-mono text-xs">{v.ip}</span> : null],
              [
                "Device",
                <span key="d" className="flex items-center gap-2">
                  <DeviceIcon device={v.device} /> {DEVICE_LABELS[v.device ?? ""] ?? "Unknown"}
                </span>,
              ],
              ["Browser", v.browser],
              ["System", v.os],
            ]}
          />
          {v.otherDevices.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 border-b border-border px-5 py-4">
                <DevicesIcon className="size-4 text-muted-foreground" aria-hidden />
                <h2 className="text-sm font-semibold">Same email on other devices</h2>
              </div>
              <ul className="divide-y divide-border">
                {v.otherDevices.map((d) => (
                  <li key={d.id}>
                    <Link href={`/admin/analytics/visitors/${d.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-surface-2/40">
                      <DeviceIcon device={d.device} />
                      <span className="min-w-0 flex-1 truncate">
                        {[d.browser, d.os].filter(Boolean).join(" on ") || "Unknown device"}
                        <span className="block text-xs text-muted-foreground">{placeLabel(d) ?? "Location unknown"}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">{timeAgo(d.lastSeenAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="lg:col-span-8">
          <h2 className="mb-3 text-sm font-semibold">
            Everything they did <span className="font-normal text-muted-foreground">· newest visit first</span>
          </h2>
          {v.sessions.length ? <Timeline v={v} /> : <p className="text-sm text-muted-foreground">No visits recorded.</p>}
          {v._count.sessions > v.sessions.length && <p className="mt-3 text-xs text-muted-foreground">Showing the latest {v.sessions.length} of {v._count.sessions} visits.</p>}
        </div>
      </div>
    </>
  );
}

export default function VisitorPage({ params }: PageProps<"/admin/analytics/visitors/[id]">) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <VisitorView params={params} />
    </Suspense>
  );
}
