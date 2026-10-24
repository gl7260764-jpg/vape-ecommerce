import Link from "next/link";
import { cn } from "@/lib/utils";

export type BarRow = { key: string; label: React.ReactNode; value: number; sub?: React.ReactNode; href?: string };

const full = new Intl.NumberFormat("en-AU");

/**
 * Ranked rows with a thin bar each (one hue). Percentages are of `base` (default: the rows' own
 * total, or `total` when the list is truncated). Says how many rows were cut.
 */
export function BarList({
  rows,
  total,
  distinct,
  empty,
  base,
  valueLabel = "visits",
}: {
  rows: BarRow[];
  total?: number;
  distinct?: number;
  empty: string;
  base?: number;
  valueLabel?: string;
}) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  const denominator = base ?? total ?? rows.reduce((n, r) => n + r.value, 0);
  return (
    <div>
      <ul className="flex flex-col gap-3">
        {rows.map((r) => {
          const pct = denominator ? (r.value / denominator) * 100 : 0;
          const label = (
            <span className="flex min-w-0 items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">
                {r.label}
                {r.sub && <span className="ml-1.5 text-xs text-muted-foreground">{r.sub}</span>}
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="font-medium">{full.format(r.value)}</span>
                <span className="ml-2 inline-block w-11 text-right text-xs text-muted-foreground">{pct >= 10 || pct === 0 ? Math.round(pct) : pct.toFixed(1)}%</span>
              </span>
            </span>
          );
          return (
            <li key={r.key}>
              {r.href ? (
                <Link href={r.href} className="block rounded-md hover:text-primary-ink">
                  {label}
                </Link>
              ) : (
                label
              )}
              <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <span className={cn("block h-full rounded-full bg-chart-mark")} style={{ width: `${Math.max(pct, r.value ? 1.5 : 0)}%` }} />
              </span>
            </li>
          );
        })}
      </ul>
      {distinct !== undefined && distinct > rows.length && (
        <p className="mt-4 text-xs text-muted-foreground">
          Top {rows.length} of {full.format(distinct)}. Percentages are of all {full.format(denominator)} {valueLabel}.
        </p>
      )}
    </div>
  );
}
