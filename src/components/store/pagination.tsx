import Link from "next/link";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react/dist/ssr";
import { toQuery, type Filters } from "@/lib/filters";
import { cn } from "@/lib/utils";

/** Page numbers with ellipses: 1 ... 4 5 [6] 7 8 ... 20 */
function pages(current: number, total: number): (number | "gap")[] {
  const set = new Set([1, total, current - 1, current, current + 1].filter((n) => n >= 1 && n <= total));
  const sorted = [...set].sort((a, b) => a - b);
  return sorted.flatMap((n, i) => (i > 0 && n - sorted[i - 1] > 1 ? ["gap" as const, n] : [n]));
}

export function Pagination({ basePath, filters, page, pageCount }: { basePath: string; filters: Filters; page: number; pageCount: number }) {
  if (pageCount <= 1) return null;
  const href = (p: number) => `${basePath}${toQuery({ ...filters, page: p })}`;
  const arrow = "grid size-11 place-items-center rounded-full border border-border transition-colors hover:border-foreground/40";
  return (
    <nav aria-label="Pagination" className="mt-16 flex items-center justify-center gap-2">
      {page > 1 ? (
        <Link href={href(page - 1)} aria-label="Previous page" className={arrow}>
          <CaretLeftIcon className="size-4" />
        </Link>
      ) : (
        <span aria-hidden className={cn(arrow, "opacity-35")}>
          <CaretLeftIcon className="size-4" />
        </span>
      )}
      <ol className="flex items-center gap-1">
        {pages(page, pageCount).map((p, i) =>
          p === "gap" ? (
            <li key={`gap-${i}`} aria-hidden className="w-6 text-center text-muted-foreground">
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                href={href(p)}
                aria-current={p === page ? "page" : undefined}
                className={cn(
                  "grid h-11 min-w-11 place-items-center rounded-full px-3 font-mono text-sm transition-colors",
                  p === page ? "bg-foreground text-background" : "text-foreground/80 hover:bg-surface-2"
                )}
              >
                {p}
              </Link>
            </li>
          )
        )}
      </ol>
      {page < pageCount ? (
        <Link href={href(page + 1)} aria-label="Next page" className={arrow}>
          <CaretRightIcon className="size-4" />
        </Link>
      ) : (
        <span aria-hidden className={cn(arrow, "opacity-35")}>
          <CaretRightIcon className="size-4" />
        </span>
      )}
    </nav>
  );
}
