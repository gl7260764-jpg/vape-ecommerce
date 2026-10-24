"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

export type ColumnPoint = {
  key: string;
  /** Short x-axis label, e.g. "23 Oct" or "2pm". */
  tick: string;
  /** Full label for the tooltip and table, e.g. "Thu 23 Oct". */
  title: string;
  value: number;
  /** Secondary readouts shown in the tooltip and table, e.g. visits and page views. */
  extra: { label: string; value: number }[];
};

const compact = new Intl.NumberFormat("en-AU", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en-AU");

/** Clean tick steps: 1, 2, 5 x 10^n, giving at most 4 gridlines above zero. */
function niceMax(max: number) {
  if (max <= 4) return { top: 4, step: 1 };
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  return { top: step * Math.ceil(max / step), step };
}

/**
 * One series as columns: thin bars (max 24px) growing from one baseline, 4px rounded tops,
 * 2px gaps, hairline grid. Hover or keyboard focus shows a tooltip; a table twin follows.
 */
export function ColumnChart({ points, valueLabel, height = 200 }: { points: ColumnPoint[]; valueLabel: string; height?: number }) {
  const [active, setActive] = useState<number | null>(null);
  const id = useId();
  const max = Math.max(0, ...points.map((p) => p.value));
  const { top, step } = niceMax(max);
  const ticks = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step);
  const every = points.length > 60 ? 15 : points.length > 31 ? 7 : points.length > 14 ? 5 : points.length > 12 ? 3 : 1;
  const current = active === null ? null : points[active];

  return (
    <div>
      <div className="flex gap-3">
        {/* y-axis ticks */}
        <div className="relative w-8 shrink-0 text-right font-mono text-[0.68rem] text-muted-foreground tabular-nums" style={{ height }} aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2" style={{ bottom: `${(t / top) * 100}%` }}>
              {compact.format(t)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* gridlines: solid hairlines, recessive */}
          <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height }} aria-hidden>
            {ticks.map((t) => (
              <div key={t} className={cn("absolute inset-x-0 h-px", t === 0 ? "bg-foreground/25" : "bg-border")} style={{ bottom: `${(t / top) * 100}%` }} />
            ))}
          </div>

          <div role="list" aria-label={`${valueLabel} per period`} className="relative flex items-end gap-[2px]" style={{ height }} onPointerLeave={() => setActive(null)}>
            {points.map((p, i) => (
              <div key={p.key} role="listitem" className="flex h-full min-w-0 flex-1 justify-center">
                <button
                  type="button"
                  aria-describedby={active === i ? `${id}-tip` : undefined}
                  aria-label={`${p.title}: ${full.format(p.value)} ${valueLabel.toLowerCase()}`}
                  onPointerEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="group flex h-full w-full max-w-6 items-end justify-center rounded-t-[4px] outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <span
                    className={cn("block w-full rounded-t-[4px] bg-chart-mark transition-opacity", active !== null && active !== i && "opacity-45")}
                    style={{ height: p.value ? `max(2px, ${(p.value / top) * 100}%)` : 0 }}
                  />
                </button>
              </div>
            ))}
          </div>

          {current && active !== null && (
            <div
              id={`${id}-tip`}
              role="tooltip"
              className="pointer-events-none absolute z-10 min-w-36 -translate-x-1/2 rounded-xl border border-border bg-popover px-3 py-2.5 text-xs shadow-[0_8px_24px_-12px_var(--shadow-strong)]"
              style={{
                left: `clamp(4.5rem, ${((active + 0.5) / points.length) * 100}%, calc(100% - 4.5rem))`,
                bottom: `calc(${height}px - ${Math.min(height - 8, Math.max(0, (current.value / top) * height))}px + 12px)`,
                top: "auto",
              }}
            >
              <p className="text-muted-foreground">{current.title}</p>
              <p className="mt-1 flex items-center gap-2">
                <span aria-hidden className="h-0.5 w-3 rounded-full bg-chart-mark" />
                <span className="text-sm font-semibold">{full.format(current.value)}</span>
                <span className="text-muted-foreground">{valueLabel.toLowerCase()}</span>
              </p>
              {current.extra.map((x) => (
                <p key={x.label} className="mt-0.5 flex justify-between gap-4 text-muted-foreground">
                  <span>{x.label}</span>
                  <span className="font-medium text-foreground tabular-nums">{full.format(x.value)}</span>
                </p>
              ))}
            </div>
          )}

          {/* x-axis band is part of the chart's height, so nothing gets clipped */}
          <div className="mt-2 flex gap-[2px] text-[0.68rem] text-muted-foreground" aria-hidden>
            {points.map((p, i) => (
              <span
                key={p.key}
                // Phones get half the labels so neighbours never touch.
                className={cn("min-w-0 flex-1 text-center whitespace-nowrap", (points.length - 1 - i) % (every * 2) !== 0 && "max-sm:invisible")}
              >
                {(points.length - 1 - i) % every === 0 ? p.tick : ""}
              </span>
            ))}
          </div>
        </div>
      </div>

      <details className="group mt-4 text-sm">
        <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Show as table</span>
          <span className="hidden group-open:inline">Hide table</span>
        </summary>
        <div data-lenis-prevent className="mt-3 max-h-72 overflow-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface">
              <tr className="text-left text-muted-foreground">
                <th scope="col" className="px-3 py-2 font-medium">
                  When
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {valueLabel}
                </th>
                {points[0]?.extra.map((x) => (
                  <th key={x.label} scope="col" className="px-3 py-2 text-right font-medium">
                    {x.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...points].reverse().map((p) => (
                <tr key={p.key}>
                  <td className="px-3 py-1.5">{p.title}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{full.format(p.value)}</td>
                  {p.extra.map((x) => (
                    <td key={x.label} className="px-3 py-1.5 text-right text-muted-foreground tabular-nums">
                      {full.format(x.value)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
