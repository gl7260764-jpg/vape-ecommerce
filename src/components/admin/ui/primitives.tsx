// Admin design primitives. Server-safe (no client hooks); modules compose these and add no new visual patterns.
import Link from "next/link";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Status: one semantic map for every badge in the admin
// ---------------------------------------------------------------------------

export type Tone = "success" | "warning" | "danger" | "info" | "brand" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-emerald-500/12 text-emerald-700 ring-emerald-600/20 dark:text-emerald-300 dark:ring-emerald-400/25",
  warning: "bg-amber-500/14 text-amber-800 ring-amber-600/25 dark:text-amber-300 dark:ring-amber-400/25",
  danger: "bg-rose-500/12 text-rose-700 ring-rose-600/20 dark:text-rose-300 dark:ring-rose-400/25",
  info: "bg-sky-500/12 text-sky-700 ring-sky-600/20 dark:text-sky-300 dark:ring-sky-400/25",
  brand: "bg-primary/15 text-primary-ink ring-primary/30",
  neutral: "bg-surface-2 text-muted-foreground ring-border",
};

const STATUS: Record<string, { label: string; tone: Tone }> = {
  // products
  active: { label: "Live", tone: "success" },
  draft: { label: "Draft", tone: "neutral" },
  archived: { label: "Archived", tone: "danger" },
  in_stock: { label: "In stock", tone: "success" },
  out_of_stock: { label: "Out of stock", tone: "danger" },
  on_backorder: { label: "Backorder", tone: "warning" },
  // taxonomy and settings
  visible: { label: "Visible", tone: "success" },
  hidden: { label: "Hidden", tone: "neutral" },
  featured: { label: "Featured", tone: "brand" },
  review: { label: "Needs review", tone: "warning" },
  enabled: { label: "On", tone: "success" },
  disabled: { label: "Off", tone: "neutral" },
};

export const statusLabel = (status: string) => STATUS[status]?.label ?? status.replace(/_/g, " ");
export const statusTone = (status: string): Tone => STATUS[status]?.tone ?? "neutral";

export function StatusPill({ status, label, tone, className }: { status?: string; label?: string; tone?: Tone; className?: string }) {
  const t = tone ?? statusTone(status ?? "");
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset", TONE_CLASS[t], className)}>
      {label ?? statusLabel(status ?? "")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  titleClassName,
}: {
  eyebrow?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** e.g. "normal-case" for titles that are data (an email), not a heading. */
  titleClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">{eyebrow}</div>}
        <h1 className={cn("font-display text-2xl leading-tight font-extrabold tracking-tight uppercase md:text-3xl", titleClassName)}>{title}</h1>
        {description && <p className="mt-1.5 max-w-[65ch] text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ className, children, ...props }: React.ComponentProps<"section">) {
  return (
    <section className={cn("rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)]", className)} {...props}>
      {children}
    </section>
  );
}

export function CardHeader({ title, description, action }: { title: string; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Buttons (links and submit buttons share one look)
// ---------------------------------------------------------------------------

export const BUTTON = {
  primary:
    "inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98] disabled:opacity-60",
  secondary:
    "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border bg-surface px-5 text-sm font-medium transition-colors outline-none hover:border-foreground/30 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
  danger:
    "inline-flex h-10 items-center justify-center gap-2 rounded-full bg-destructive px-5 text-sm font-semibold text-white transition-transform outline-none focus-visible:ring-3 focus-visible:ring-destructive/40 active:scale-[0.98] disabled:opacity-60",
  icon: "grid size-9 place-items-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-surface-2 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
};

// ---------------------------------------------------------------------------
// Stat tiles: the number and the filter it represents are one control
// ---------------------------------------------------------------------------

export function StatTile({
  label,
  value,
  icon: IconComp,
  href,
  active,
  tone = "neutral",
}: {
  label: string;
  value: number;
  icon: Icon;
  href?: string;
  active?: boolean;
  tone?: Tone;
}) {
  const body = (
    <>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset", TONE_CLASS[tone])}>
        <IconComp weight="fill" className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl leading-none font-semibold tracking-tight tabular-nums">{value.toLocaleString("en-AU")}</span>
        <span className="mt-1.5 block truncate text-xs text-muted-foreground">{label}</span>
      </span>
    </>
  );
  const cls = cn(
    "flex items-center gap-3.5 rounded-2xl border bg-surface p-4 transition-colors",
    active ? "border-primary ring-1 ring-primary/40" : "border-border",
    href && !active && "hover:border-foreground/25"
  );
  return href ? (
    <Link href={href} className={cls} aria-current={active ? "true" : undefined}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

// ---------------------------------------------------------------------------
// Chips: filters are links carrying URL params, never client state
// ---------------------------------------------------------------------------

export function Chip({ href, active, children, count }: { href: string; active?: boolean; children: React.ReactNode; count?: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors",
        active ? "border-foreground bg-foreground text-background" : "border-border text-foreground/80 hover:border-foreground/40 hover:text-foreground"
      )}
    >
      {children}
      {count !== undefined && <span className={cn("font-mono text-xs tabular-nums", active ? "text-background/70" : "text-muted-foreground")}>{count.toLocaleString("en-AU")}</span>}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Empty state: never a blank list
// ---------------------------------------------------------------------------

export function EmptyState({ icon: IconComp, title, description, action }: { icon: Icon; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-surface-2">
        <IconComp className="size-6 text-muted-foreground" aria-hidden />
      </span>
      <p className="mt-5 font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tables (lg+). Overflow scrolls inside the card, never the page.
// ---------------------------------------------------------------------------

export function Table({ children }: { children: React.ReactNode }) {
  return (
    // relative: keeps absolutely positioned children (sr-only labels) inside the scroll box
    <div className="relative hidden overflow-x-auto lg:block">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th scope="col" className={cn("border-b border-border px-4 py-3 text-left text-[0.68rem] font-medium tracking-[0.12em] whitespace-nowrap text-muted-foreground uppercase first:pl-5 last:pr-5", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle first:pl-5 last:pr-5", className)}>{children}</td>;
}

/** The < lg twin of a table: stacked cards. */
export function MobileList({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y divide-border lg:hidden">{children}</ul>;
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export function Pagination({ page, pageCount, total, pageSize, href }: { page: number; pageCount: number; total: number; pageSize: number; href: (page: number) => string }) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const link = "inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3.5 text-sm transition-colors hover:border-foreground/40";
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-5 py-4 sm:flex-row">
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-mono tabular-nums">{from.toLocaleString("en-AU")}</span>-<span className="font-mono tabular-nums">{to.toLocaleString("en-AU")}</span> of{" "}
        <span className="font-mono tabular-nums">{total.toLocaleString("en-AU")}</span>
      </p>
      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link href={href(page - 1)} className={link} rel="prev">
              <CaretLeftIcon className="size-3.5" aria-hidden /> Previous
            </Link>
          ) : (
            <span className={cn(link, "pointer-events-none opacity-40")}>
              <CaretLeftIcon className="size-3.5" aria-hidden /> Previous
            </span>
          )}
          <span className="px-2 font-mono text-sm tabular-nums text-muted-foreground">
            {page} / {pageCount}
          </span>
          {page < pageCount ? (
            <Link href={href(page + 1)} className={link} rel="next">
              Next <CaretRightIcon className="size-3.5" aria-hidden />
            </Link>
          ) : (
            <span className={cn(link, "pointer-events-none opacity-40")}>
              Next <CaretRightIcon className="size-3.5" aria-hidden />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
