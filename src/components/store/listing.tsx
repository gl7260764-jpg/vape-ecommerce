import Link from "next/link";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr";
import { FilterSidebar, ListingProvider, ListingToolbar, ResultsArea } from "@/components/store/listing-controls";
import { Pagination } from "@/components/store/pagination";
import { ProductGrid, ProductGridSkeleton } from "@/components/store/product-grid";
import { listProducts, type ListingScope } from "@/lib/catalog-queries";
import { parseFilters } from "@/lib/filters";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const SHELL = "mx-auto grid max-w-[1400px] grid-cols-1 gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-14 lg:px-10 lg:py-16";

/** Filterable product listing for a scope. Reads searchParams, so render it inside <Suspense>. */
export async function Listing({ scope, searchParams, basePath }: { scope: ListingScope; searchParams: SearchParams; basePath: string }) {
  const filters = parseFilters(await searchParams);
  const data = await listProducts(scope, filters);
  const hideBrand = Boolean(scope.brand);

  return (
    <ListingProvider basePath={basePath} filters={{ ...filters, page: data.page }}>
      <div className={SHELL}>
        <FilterSidebar facets={data.facets} hideBrand={hideBrand} />
        <div className="min-w-0">
          <ListingToolbar total={data.total} facets={data.facets} hideBrand={hideBrand} />
          <ResultsArea>
            {data.items.length > 0 ? (
              <ProductGrid items={data.items} />
            ) : (
              <div className="flex flex-col items-center rounded-[var(--radius-tile)] border border-dashed border-border px-6 py-20 text-center">
                <span className="grid size-14 place-items-center rounded-full bg-surface-2">
                  <MagnifyingGlassIcon className="size-6 text-muted-foreground" />
                </span>
                <p className="mt-5 font-medium">Nothing matches these filters</p>
                <p className="mt-1 max-w-[36ch] text-sm text-muted-foreground">Try removing a filter or two to see more products.</p>
                <Link href={basePath} className="mt-6 inline-flex h-11 items-center rounded-full bg-foreground px-6 text-sm font-medium text-background">
                  Clear filters
                </Link>
              </div>
            )}
          </ResultsArea>
          <Pagination basePath={basePath} filters={filters} page={data.page} pageCount={data.pageCount} />
        </div>
      </div>
    </ListingProvider>
  );
}

export function ListingFallback() {
  return (
    <div className={SHELL}>
      <div aria-hidden className="hidden space-y-4 lg:block">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-5 animate-pulse rounded bg-surface-2" style={{ width: `${60 + ((i * 17) % 35)}%` }} />
        ))}
      </div>
      <div>
        <div className="mb-8 h-10 w-40 animate-pulse rounded-full bg-surface-2" />
        <ProductGridSkeleton />
      </div>
    </div>
  );
}
