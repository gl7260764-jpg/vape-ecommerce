// Analytics building blocks, server-rendered. Filters are links; nothing here holds client state.
import Link from "next/link";
import {
  ArrowClockwiseIcon,
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  BellRingingIcon,
  CreditCardIcon,
  DesktopIcon,
  DeviceMobileIcon,
  DeviceTabletIcon,
  EnvelopeSimpleIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  MinusCircleIcon,
  ReceiptIcon,
  ShoppingBagIcon,
  ShoppingCartSimpleIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { Chip } from "@/components/admin/ui/primitives";
import { analyticsHref, PERIODS, type AnalyticsParams } from "@/lib/admin/queries/analytics";
import type { VisitorEventType } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";

export const EVENT_ICONS: Record<VisitorEventType, Icon> = {
  page_view: EyeIcon,
  add_to_cart: ShoppingCartSimpleIcon,
  remove_from_cart: MinusCircleIcon,
  open_cart: ShoppingBagIcon,
  search: MagnifyingGlassIcon,
  begin_checkout: CreditCardIcon,
  place_order: ReceiptIcon,
  subscribe: EnvelopeSimpleIcon,
  install_app: DeviceMobileIcon,
  enable_notifications: BellRingingIcon,
};

/** Shop actions stand out from plain page views. */
export function EventDot({ type }: { type: VisitorEventType }) {
  const IconComp = EVENT_ICONS[type];
  const strong = type === "place_order" || type === "subscribe";
  const shop = type !== "page_view";
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-surface",
        strong ? "bg-primary text-primary-foreground" : shop ? "bg-primary/15 text-primary-ink" : "bg-surface-2 text-muted-foreground"
      )}
    >
      <IconComp weight={strong ? "fill" : "regular"} className="size-4" />
    </span>
  );
}

export function DeviceIcon({ device, className }: { device: string | null; className?: string }) {
  const IconComp = device === "mobile" ? DeviceMobileIcon : device === "tablet" ? DeviceTabletIcon : DesktopIcon;
  return <IconComp className={cn("size-4 text-muted-foreground", className)} aria-label={device ?? "Unknown device"} />;
}

/** Period presets, the bots/team toggle and a refresh link: one row above everything they scope. */
export function AnalyticsFilters({ base, params, hidden }: { base: string; params: AnalyticsParams; hidden?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PERIODS.map((p) => (
        <Chip key={p.value} href={analyticsHref(base, params, { period: p.value })} active={params.period === p.value}>
          {p.label}
        </Chip>
      ))}
      <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />
      <Chip href={analyticsHref(base, params, { all: !params.all })} active={params.all}>
        {params.all ? "Including bots and team" : `Hiding bots and team${hidden ? ` (${hidden.toLocaleString("en-AU")})` : ""}`}
      </Chip>
      <Link
        href={analyticsHref(base, params, {})}
        prefetch={false}
        className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-muted-foreground hover:bg-surface-2 hover:text-foreground"
      >
        <ArrowClockwiseIcon className="size-4" aria-hidden /> Refresh
      </Link>
    </div>
  );
}

const full = new Intl.NumberFormat("en-AU");

/** A headline number with its change against the previous equal-length period. */
export function Kpi({
  label,
  value,
  previous,
  format = (n) => full.format(n),
  hint,
  icon: IconComp,
}: {
  label: string;
  value: number;
  previous: number;
  format?: (n: number) => string;
  hint?: string;
  icon: Icon;
}) {
  const change = previous ? (value - previous) / previous : value ? 1 : 0;
  const flat = Math.abs(change) < 0.005;
  const up = change > 0;
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <IconComp className="size-4" aria-hidden />
        {label}
      </div>
      <p className="mt-3 text-[1.65rem] leading-none font-semibold tracking-tight">{format(value)}</p>
      <p className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
        {flat ? (
          <span className="text-muted-foreground">No change</span>
        ) : (
          <span className={cn("inline-flex items-center gap-0.5 font-medium", up ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
            {up ? <ArrowUpRightIcon className="size-3.5" aria-hidden /> : <ArrowDownRightIcon className="size-3.5" aria-hidden />}
            {up ? "Up" : "Down"} {previous ? `${Math.round(Math.abs(change) * 100)}%` : ""}
          </span>
        )}
        <span className="text-muted-foreground">{hint ?? `from ${format(previous)}`}</span>
      </p>
    </div>
  );
}
