import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import {
  ArchiveIcon,
  ArrowSquareOutIcon,
  CheckCircleIcon,
  FlagIcon,
  MagnifyingGlassIcon,
  PackageIcon,
  PencilSimpleIcon,
  PlusIcon,
  ProhibitIcon,
  StackIcon,
  StarIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { deleteProduct } from "@/app/actions/admin/products";
import { ConfirmDelete } from "@/components/admin/ui/confirm-delete";
import { BUTTON, Card, Chip, EmptyState, MobileList, PageHeader, Pagination, StatTile, StatusPill, Table, Td, Th, type Tone } from "@/components/admin/ui/primitives";
import { SearchBox } from "@/components/admin/ui/search-box";
import { ListSkeleton } from "@/components/admin/ui/skeletons";
import { UrlSelect } from "@/components/admin/ui/url-select";
import { can, requireAdminPage } from "@/lib/admin/auth";
import { formatDate } from "@/lib/admin/format";
import {
  listAdminProducts,
  parseProductParams,
  PRODUCT_PAGE_SIZE,
  PRODUCT_SORTS,
  productListHref,
  type AdminProductRow,
  type ProductView,
} from "@/lib/admin/queries/products";
import { PRODUCT_TYPES } from "@/lib/admin/schemas/product";
import { formatPrice } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Products" };

const TILES: { view: ProductView; label: string; icon: Icon; tone: Tone }[] = [
  { view: "all", label: "All products", icon: StackIcon, tone: "neutral" },
  { view: "active", label: "Live", icon: CheckCircleIcon, tone: "success" },
  { view: "draft", label: "Drafts", icon: PencilSimpleIcon, tone: "neutral" },
  { view: "archived", label: "Archived", icon: ArchiveIcon, tone: "danger" },
  { view: "out", label: "Out of stock", icon: ProhibitIcon, tone: "warning" },
  { view: "review", label: "Needs review", icon: FlagIcon, tone: "warning" },
];

const typeLabel = (type: string) => PRODUCT_TYPES.find((t) => t.value === type)?.label ?? type;

function Thumb({ row, size }: { row: AdminProductRow; size: "sm" | "lg" }) {
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-xl bg-tile", size === "sm" ? "size-12" : "size-16")}>
      {row.image ? (
        <Image
          src={row.image}
          alt=""
          fill
          sizes={size === "sm" ? "48px" : "64px"}
          className={row.imageFit === "cover" ? "scale-[1.12] object-cover" : "object-contain p-1"}
        />
      ) : (
        <PackageIcon className="absolute inset-0 m-auto size-5 text-tile-foreground/40" aria-hidden />
      )}
    </div>
  );
}

function Price({ row }: { row: AdminProductRow }) {
  return (
    <span className="font-mono tabular-nums">
      {row.price > 0 ? formatPrice(row.price) : <span className="text-destructive">No price</span>}
      {row.compareAt && <span className="ml-1.5 text-xs text-muted-foreground line-through">{formatPrice(row.compareAt)}</span>}
    </span>
  );
}

function Badges({ row }: { row: AdminProductRow }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <StatusPill status={row.status} />
      {row.stockStatus !== "in_stock" && <StatusPill status={row.stockStatus} />}
      {row.needsReview && <StatusPill status="review" />}
      {row.isFeatured && (
        <span className="text-primary-ink" title="Featured">
          <StarIcon weight="fill" className="size-4" aria-label="Featured" />
        </span>
      )}
    </span>
  );
}

async function ProductsView({ searchParams }: Pick<PageProps<"/admin/products">, "searchParams">) {
  const params = parseProductParams(await searchParams);
  const admin = await requireAdminPage();
  const data = await listAdminProducts(params);
  const canDelete = can(admin.role, "catalog:delete");
  const filtered = Boolean(params.q || params.brand || params.category || params.type || params.view !== "all");

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        description={`${data.viewCounts.all.toLocaleString("en-AU")} products${filtered ? " match the search and filters" : " in the catalog"}.`}
        actions={
          <Link href="/admin/products/new" className={BUTTON.primary}>
            <PlusIcon weight="bold" className="size-4" aria-hidden />
            <span className="sm:hidden">New</span>
            <span className="hidden sm:inline">New product</span>
          </Link>
        }
      />

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {TILES.map((t) => (
          <StatTile
            key={t.view}
            label={t.label}
            value={data.viewCounts[t.view]}
            icon={t.icon}
            tone={params.view === t.view ? "brand" : t.tone}
            active={params.view === t.view}
            href={productListHref(params, { view: t.view })}
          />
        ))}
      </div>

      <Card className="mt-6">
        <div className="grid grid-cols-1 gap-3 border-b border-border p-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
          <SearchBox placeholder="Search name, flavour, brand or SKU" className="md:col-span-2 xl:col-span-1" />
          <UrlSelect name="brand" label="Brand" allLabel="All brands" options={data.brands.map((b) => ({ value: b.slug, label: b.name }))} />
          <UrlSelect name="category" label="Category" allLabel="All categories" options={data.categories.map((c) => ({ value: c.slug, label: c.name }))} />
          <UrlSelect name="sort" label="Sort" allLabel="Recently edited" options={PRODUCT_SORTS.filter((s) => s.value !== "updated").map((s) => ({ value: s.value, label: s.label }))} />
        </div>
        <div className="flex gap-2 overflow-x-auto border-b border-border px-4 py-3 [scrollbar-width:none]">
          <Chip href={productListHref(params, { type: "" })} active={!params.type}>
            All types
          </Chip>
          {PRODUCT_TYPES.filter((t) => data.typeCounts[t.value]).map((t) => (
            <Chip key={t.value} href={productListHref(params, { type: t.value })} active={params.type === t.value} count={data.typeCounts[t.value]}>
              {t.label}
            </Chip>
          ))}
        </div>

        {data.rows.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={MagnifyingGlassIcon}
              title="Nothing matches"
              description="No products fit this search and these filters. Try fewer filters or a different word."
              action={
                <Link href="/admin/products" className={BUTTON.secondary}>
                  Clear filters
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon={PackageIcon}
              title="No products yet"
              description="Add your first product and it appears in the store as soon as it's live."
              action={
                <Link href="/admin/products/new" className={BUTTON.primary}>
                  New product
                </Link>
              }
            />
          )
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th className="text-right">Price</Th>
                  <Th>Status</Th>
                  <Th>Edited</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.rows.map((row) => (
                  <tr key={row.id} className="group transition-colors hover:bg-surface-2/40">
                    <Td>
                      <Link href={`/admin/products/${row.id}`} className="flex min-w-0 items-center gap-3">
                        <Thumb row={row} size="sm" />
                        <span className="min-w-0">
                          <span className="block max-w-[28rem] truncate font-medium group-hover:text-primary-ink">{row.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{[typeLabel(row.type), row.brand, row.category].filter(Boolean).join(" · ")}</span>
                        </span>
                      </Link>
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      <Price row={row} />
                    </Td>
                    <Td>
                      <Badges row={row} />
                    </Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{formatDate(row.updatedAt)}</Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1 opacity-60 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                        <Link href={`/admin/products/${row.id}`} aria-label={`Edit ${row.name}`} className={BUTTON.icon}>
                          <PencilSimpleIcon className="size-4" />
                        </Link>
                        {row.status === "active" && (
                          <a href={`/product/${row.slug}`} target="_blank" rel="noreferrer" aria-label={`View ${row.name} in the store`} className={BUTTON.icon}>
                            <ArrowSquareOutIcon className="size-4" />
                          </a>
                        )}
                        {canDelete && <ConfirmDelete name={row.name} kind="product" action={deleteProduct.bind(null, row.id)} />}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <MobileList>
              {data.rows.map((row) => (
                <li key={row.id}>
                  <Link href={`/admin/products/${row.id}`} className="flex gap-3.5 px-4 pt-4 pb-3">
                    <Thumb row={row} size="lg" />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 font-medium">{row.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {typeLabel(row.type)}
                        {row.brand && ` · ${row.brand}`}
                      </span>
                      <span className="mt-1.5 block text-lg">
                        <Price row={row} />
                      </span>
                    </span>
                  </Link>
                  <div className="px-4 pb-3">
                    <Badges row={row} />
                  </div>
                  <div className="flex divide-x divide-border border-t border-border">
                    <Link href={`/admin/products/${row.id}`} className="flex min-h-11 flex-1 items-center justify-center gap-2 text-sm font-medium hover:bg-surface-2/50">
                      <PencilSimpleIcon className="size-4" aria-hidden /> Edit
                    </Link>
                    {row.status === "active" && (
                      <a href={`/product/${row.slug}`} target="_blank" rel="noreferrer" className="flex min-h-11 flex-1 items-center justify-center gap-2 text-sm font-medium hover:bg-surface-2/50">
                        <ArrowSquareOutIcon className="size-4" aria-hidden /> View
                      </a>
                    )}
                    {canDelete && <ConfirmDelete name={row.name} kind="product" action={deleteProduct.bind(null, row.id)} variant="bar" />}
                  </div>
                </li>
              ))}
            </MobileList>

            <Pagination
              page={params.page}
              pageCount={data.pageCount}
              total={data.total}
              pageSize={PRODUCT_PAGE_SIZE}
              href={(page) => productListHref(params, { page })}
            />
          </>
        )}
      </Card>
    </>
  );
}

export default function AdminProductsPage({ searchParams }: PageProps<"/admin/products">) {
  return (
    <Suspense fallback={<ListSkeleton tiles={6} />}>
      <ProductsView searchParams={searchParams} />
    </Suspense>
  );
}
