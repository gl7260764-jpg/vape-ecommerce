"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, FunnelSimpleIcon, XIcon } from "@phosphor-icons/react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  activeFilterCount,
  FAMILY_LABELS,
  PRICE_BANDS,
  SORTS,
  toQuery,
  TYPE_LABELS,
  type Filters,
  type PriceBand,
  type Sort,
} from "@/lib/filters";
import type { Facet } from "@/lib/catalog-queries";
import { useLenisLock } from "@/hooks/use-lenis-lock";
import { cn } from "@/lib/utils";

export type Facets = { brands: Facet[]; types: Facet[]; families: Facet[]; prices: Facet[] };

type Ctx = { filters: Filters; pending: boolean; apply: (next: Partial<Filters>) => void };
const ListingContext = createContext<Ctx | null>(null);
const useListing = () => {
  const ctx = useContext(ListingContext);
  if (!ctx) throw new Error("Listing controls must sit inside <ListingProvider>");
  return ctx;
};

/** Filter changes navigate to the new URL inside a transition, so results stay visible (dimmed) until the next page streams in. */
export function ListingProvider({ basePath, filters, children }: { basePath: string; filters: Filters; children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const apply = (next: Partial<Filters>) => {
    const merged = { ...filters, ...next, page: next.page ?? 1 };
    startTransition(() => router.push(`${basePath}${toQuery(merged)}`, { scroll: false }));
  };
  return <ListingContext.Provider value={{ filters, pending, apply }}>{children}</ListingContext.Provider>;
}

export function ResultsArea({ children }: { children: React.ReactNode }) {
  const { pending } = useListing();
  return (
    <div aria-busy={pending} className={cn("transition-opacity duration-300", pending && "pointer-events-none opacity-45")}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------

const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value].sort());

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-border py-6 first:border-t-0 first:pt-0">
      <legend className="float-left mb-4 w-full text-sm font-semibold">{title}</legend>
      <div className="clear-left">{children}</div>
    </fieldset>
  );
}

function CheckRow({ label, count, checked, onChange }: { label: string; count: number; checked: boolean; onChange: () => void }) {
  return (
    <label className="group flex cursor-pointer items-center gap-3 rounded-lg py-1.5 text-sm">
      <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" />
      <span
        aria-hidden
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-md border transition-colors peer-focus-visible:ring-3 peer-focus-visible:ring-ring",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-input group-hover:border-foreground/40"
        )}
      >
        {checked && <CheckIcon weight="bold" className="size-3" />}
      </span>
      <span className={cn("min-w-0 flex-1 truncate", checked ? "text-foreground" : "text-foreground/80")}>{label}</span>
      <span className="font-mono text-xs text-muted-foreground">{count}</span>
    </label>
  );
}

function FilterGroups({ facets, hideBrand }: { facets: Facets; hideBrand?: boolean }) {
  const { filters, apply } = useListing();
  const [allBrands, setAllBrands] = useState(false);
  const brands = allBrands ? facets.brands : facets.brands.slice(0, 8);

  return (
    <div>
      {!hideBrand && facets.brands.length > 1 && (
        <Group title="Brand">
          {brands.map((b) => (
            <CheckRow
              key={b.value}
              label={b.label ?? b.value}
              count={b.count}
              checked={filters.brand.includes(b.value)}
              onChange={() => apply({ brand: toggle(filters.brand, b.value) })}
            />
          ))}
          {facets.brands.length > 8 && (
            <button
              type="button"
              onClick={() => setAllBrands((v) => !v)}
              className="mt-2 text-sm font-medium text-primary-ink hover:underline"
            >
              {allBrands ? "Show fewer" : `Show all ${facets.brands.length} brands`}
            </button>
          )}
        </Group>
      )}
      {facets.types.length > 1 && (
        <Group title="Type">
          {facets.types.map((t) => (
            <CheckRow
              key={t.value}
              label={TYPE_LABELS[t.value] ?? t.value}
              count={t.count}
              checked={filters.type.includes(t.value)}
              onChange={() => apply({ type: toggle(filters.type, t.value) })}
            />
          ))}
        </Group>
      )}
      {facets.families.length > 1 && (
        <Group title="Flavour">
          {facets.families.map((f) => (
            <CheckRow
              key={f.value}
              label={FAMILY_LABELS[f.value] ?? f.value}
              count={f.count}
              checked={filters.family.includes(f.value)}
              onChange={() => apply({ family: toggle(filters.family, f.value) })}
            />
          ))}
        </Group>
      )}
      <Group title="Price">
        <div className="flex flex-wrap gap-2">
          {facets.prices.map((p) => {
            const on = filters.price === p.value;
            return (
              <button
                key={p.value}
                type="button"
                aria-pressed={on}
                disabled={!p.count && !on}
                onClick={() => apply({ price: on ? null : (p.value as PriceBand) })}
                className={cn(
                  "h-9 rounded-full border px-3.5 text-sm transition-colors disabled:opacity-35",
                  on ? "border-foreground bg-foreground text-background" : "border-border text-foreground/80 hover:border-foreground/40"
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </Group>
    </div>
  );
}

/** Desktop sidebar. */
export function FilterSidebar({ facets, hideBrand }: { facets: Facets; hideBrand?: boolean }) {
  const { filters, apply } = useListing();
  return (
    <aside aria-label="Filters" className="hidden lg:block">
      <div className="sticky top-28 max-h-[calc(100dvh-8rem)] overflow-y-auto pr-2 [scrollbar-width:thin]" data-lenis-prevent>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold uppercase">Filters</h2>
          {activeFilterCount(filters) > 0 && (
            <button type="button" onClick={() => apply({ brand: [], type: [], family: [], price: null })} className="text-sm text-muted-foreground hover:text-foreground">
              Clear all
            </button>
          )}
        </div>
        <FilterGroups facets={facets} hideBrand={hideBrand} />
      </div>
    </aside>
  );
}

/** Result count, mobile filter sheet, sort menu and removable chips for active filters. */
export function ListingToolbar({ total, facets, hideBrand }: { total: number; facets: Facets; hideBrand?: boolean }) {
  const { filters, apply, pending } = useListing();
  const [open, setOpen] = useState(false);
  useLenisLock(open);
  const active = activeFilterCount(filters);
  const brandLabel = (slug: string) => facets.brands.find((b) => b.value === slug)?.label ?? slug;

  const chips = [
    ...filters.brand.map((v) => ({ key: `b-${v}`, label: brandLabel(v), clear: () => apply({ brand: filters.brand.filter((x) => x !== v) }) })),
    ...filters.type.map((v) => ({ key: `t-${v}`, label: TYPE_LABELS[v] ?? v, clear: () => apply({ type: filters.type.filter((x) => x !== v) }) })),
    ...filters.family.map((v) => ({ key: `f-${v}`, label: FAMILY_LABELS[v] ?? v, clear: () => apply({ family: filters.family.filter((x) => x !== v) }) })),
    ...(filters.price
      ? [{ key: "price", label: PRICE_BANDS.find((p) => p.value === filters.price)?.label ?? "", clear: () => apply({ price: null }) }]
      : []),
  ];

  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-center gap-3">
        <p className="mr-auto text-sm text-muted-foreground" aria-live="polite">
          {pending ? "Updating..." : `${total.toLocaleString("en-AU")} ${total === 1 ? "result" : "results"}`}
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium lg:hidden"
        >
          <FunnelSimpleIcon className="size-4" />
          Filters
          {active > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 font-mono text-[0.7rem] leading-5 text-primary-foreground">{active}</span>}
        </button>
        <label className="relative inline-flex h-10 items-center rounded-full border border-border pr-3 pl-4 text-sm">
          <span className="sr-only">Sort by</span>
          <select
            value={filters.sort}
            onChange={(e) => apply({ sort: e.target.value as Sort })}
            className="h-full cursor-pointer appearance-none bg-transparent pr-6 text-sm text-foreground outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value} className="bg-popover text-popover-foreground">
                {s.label}
              </option>
            ))}
          </select>
          <span aria-hidden className="pointer-events-none absolute right-3.5 text-xs text-muted-foreground">
            ▾
          </span>
        </label>
      </div>

      {chips.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {chips.map((c) => (
            <li key={c.key}>
              <button
                type="button"
                onClick={c.clear}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-2 pr-2.5 pl-3.5 text-sm text-foreground transition-colors hover:bg-foreground hover:text-background"
              >
                {c.label}
                <XIcon aria-label={`Remove ${c.label}`} className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[88%] max-w-sm gap-0 border-border bg-surface p-0">
          <div className="flex items-center justify-between border-b border-border px-6 py-5">
            <SheetTitle className="font-display text-lg font-bold uppercase">Filters</SheetTitle>
          </div>
          <div data-lenis-prevent className="flex-1 overflow-y-auto px-6 py-6">
            <FilterGroups facets={facets} hideBrand={hideBrand} />
          </div>
          <div className="flex gap-3 border-t border-border p-5">
            <button
              type="button"
              onClick={() => apply({ brand: [], type: [], family: [], price: null })}
              className="h-12 flex-1 rounded-full border border-border text-sm font-medium"
            >
              Clear
            </button>
            <button type="button" onClick={() => setOpen(false)} className="h-12 flex-[2] rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {pending ? "Updating..." : `Show ${total.toLocaleString("en-AU")} results`}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
