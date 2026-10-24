import Link from "next/link";
import { CaretRightIcon, EnvelopeSimpleIcon, ReceiptIcon, RobotIcon, UserCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { DeviceIcon } from "@/components/admin/analytics/parts";
import { MobileList, StatusPill, Table, Td, Th } from "@/components/admin/ui/primitives";
import type { VisitorRow } from "@/lib/admin/queries/analytics";
import { timeAgo } from "@/lib/admin/time";
import { CHANNEL_LABELS, countryName, placeLabel } from "@/lib/analytics/labels";

/** "dana@example.com" when known, else "Visitor from Sydney", else "Anonymous visitor". */
export function visitorName(v: Pick<VisitorRow, "email" | "city" | "region" | "country">) {
  if (v.email) return v.email;
  const place = v.city ?? v.region ?? countryName(v.country);
  return place ? `Visitor from ${place}` : "Anonymous visitor";
}

function Badges({ v }: { v: VisitorRow }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {v._count.orders > 0 && <StatusPill tone="success" label={`${v._count.orders} ${v._count.orders === 1 ? "order" : "orders"}`} />}
      {v._count.subscribers > 0 && <StatusPill tone="brand" label="Subscriber" />}
      {v.sessionCount > 1 && <StatusPill tone="info" label="Returning" />}
      {v.isInternal && <StatusPill tone="neutral" label="Team" />}
      {v.isBot && <StatusPill tone="warning" label="Bot" />}
    </span>
  );
}

function Who({ v }: { v: VisitorRow }) {
  const IconComp = v.isBot ? RobotIcon : v.email ? EnvelopeSimpleIcon : UserCircleIcon;
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2">
        <IconComp className="size-4 text-muted-foreground" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium group-hover:text-primary-ink">{visitorName(v)}</span>
        <span className="block truncate text-xs text-muted-foreground">{placeLabel(v) ?? "Location unknown"}</span>
      </span>
    </span>
  );
}

/** Visitors as a table at lg+, cards below. Every row opens the visitor's full history. */
export function VisitorTable({ rows }: { rows: VisitorRow[] }) {
  const now = new Date();
  return (
    <>
      <Table>
        <thead>
          <tr>
            <Th>Visitor</Th>
            <Th>Came from</Th>
            <Th>Device</Th>
            <Th className="text-right">Visits</Th>
            <Th className="text-right">Pages</Th>
            <Th>Last seen</Th>
            <Th>
              <span className="sr-only">Details</span>
            </Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((v) => (
            <tr key={v.id} className="group transition-colors hover:bg-surface-2/40">
              <Td className="max-w-80">
                <Link href={`/admin/analytics/visitors/${v.id}`} className="block">
                  <Who v={v} />
                </Link>
                <div className="mt-1.5 pl-12 empty:hidden">
                  <Badges v={v} />
                </div>
              </Td>
              <Td>
                <span className="block font-medium">{v.firstSource ?? "Direct"}</span>
                <span className="block text-xs text-muted-foreground">{v.firstChannel ? CHANNEL_LABELS[v.firstChannel] : "Unknown"}</span>
              </Td>
              <Td>
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <DeviceIcon device={v.device} />
                  <span className="text-muted-foreground">{[v.browser, v.os].filter(Boolean).join(" · ") || "Unknown"}</span>
                </span>
              </Td>
              <Td className="text-right tabular-nums">{v.sessionCount}</Td>
              <Td className="text-right tabular-nums">{v.pageviewCount}</Td>
              <Td className="whitespace-nowrap text-muted-foreground">
                <time dateTime={v.lastSeenAt.toISOString()}>{timeAgo(v.lastSeenAt, now)}</time>
              </Td>
              <Td>
                <Link href={`/admin/analytics/visitors/${v.id}`} aria-label={`Open ${visitorName(v)}`} className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground">
                  <CaretRightIcon className="size-4" />
                </Link>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <MobileList>
        {rows.map((v) => (
          <li key={v.id}>
            <Link href={`/admin/analytics/visitors/${v.id}`} className="group block px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <Who v={v} />
                <time dateTime={v.lastSeenAt.toISOString()} className="shrink-0 text-xs text-muted-foreground">
                  {timeAgo(v.lastSeenAt, now)}
                </time>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 pl-12 text-xs text-muted-foreground">
                <span>
                  From <span className="font-medium text-foreground">{v.firstSource ?? "Direct"}</span>
                </span>
                <span className="flex items-center gap-1">
                  <DeviceIcon device={v.device} className="size-3.5" /> {v.browser ?? "Unknown"}
                </span>
                <span>
                  {v.sessionCount} {v.sessionCount === 1 ? "visit" : "visits"} · {v.pageviewCount} pages
                </span>
                {v._count.orders > 0 && (
                  <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                    <ReceiptIcon className="size-3.5" aria-hidden /> ordered
                  </span>
                )}
              </div>
              <div className="mt-2 pl-12 empty:hidden">
                <Badges v={v} />
              </div>
            </Link>
          </li>
        ))}
      </MobileList>
    </>
  );
}
