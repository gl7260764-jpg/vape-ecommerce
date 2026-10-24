import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowSquareOutIcon, EyeIcon, EyeSlashIcon, FoldersIcon, MagnifyingGlassIcon, PencilSimpleIcon, PlusIcon, StarIcon } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { deleteCategory } from "@/app/actions/admin/taxonomy";
import { FlagSwitch } from "@/components/admin/taxonomy/flag-switch";
import { ConfirmDelete } from "@/components/admin/ui/confirm-delete";
import { BUTTON, Card, Chip, EmptyState, MobileList, PageHeader, StatTile, StatusPill, Table, Td, Th, type Tone } from "@/components/admin/ui/primitives";
import { SearchBox } from "@/components/admin/ui/search-box";
import { ListSkeleton } from "@/components/admin/ui/skeletons";
import { can, requireAdminPage } from "@/lib/admin/auth";
import { categoryListHref, listAdminCategories, parseCategoryParams, type AdminCategoryRow, type CategoryView } from "@/lib/admin/queries/taxonomy";
import { CATEGORY_KINDS, kindLabel } from "@/lib/admin/schemas/taxonomy";

export const metadata: Metadata = { title: "Categories" };

const TILES: { view: CategoryView; label: string; icon: Icon; tone: Tone }[] = [
  { view: "all", label: "All categories", icon: FoldersIcon, tone: "neutral" },
  { view: "visible", label: "Visible in store", icon: EyeIcon, tone: "success" },
  { view: "hidden", label: "Hidden", icon: EyeSlashIcon, tone: "neutral" },
  { view: "featured", label: "On the homepage", icon: StarIcon, tone: "brand" },
];

function Thumb({ row }: { row: AdminCategoryRow }) {
  return (
    <div className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-tile">
      {row.image ? <Image src={row.image} alt="" fill sizes="44px" className="object-cover" /> : <FoldersIcon className="absolute inset-0 m-auto size-5 text-tile-foreground/40" aria-hidden />}
    </div>
  );
}

async function CategoriesView({ searchParams }: Pick<PageProps<"/admin/categories">, "searchParams">) {
  const params = parseCategoryParams(await searchParams);
  const admin = await requireAdminPage();
  const data = await listAdminCategories(params);
  const canDelete = can(admin.role, "catalog:delete");
  const filtered = Boolean(params.q || params.kind || params.view !== "all");

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Categories"
        description="How products are grouped in the shop. Hide a category to take it off the store without touching its products."
        actions={
          <Link href="/admin/categories/new" className={BUTTON.primary}>
            <PlusIcon weight="bold" className="size-4" aria-hidden />
            <span className="sm:hidden">New</span>
            <span className="hidden sm:inline">New category</span>
          </Link>
        }
      />

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TILES.map((t) => (
          <StatTile
            key={t.view}
            label={t.label}
            value={data.viewCounts[t.view]}
            icon={t.icon}
            tone={params.view === t.view ? "brand" : t.tone}
            active={params.view === t.view}
            href={categoryListHref(params, { view: t.view })}
          />
        ))}
      </div>

      <Card className="mt-6">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
          <SearchBox placeholder="Search categories" className="lg:w-80" />
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
            <Chip href={categoryListHref(params, { kind: "" })} active={!params.kind}>
              All kinds
            </Chip>
            {CATEGORY_KINDS.filter((k) => data.kindCounts[k.value]).map((k) => (
              <Chip key={k.value} href={categoryListHref(params, { kind: k.value })} active={params.kind === k.value} count={data.kindCounts[k.value]}>
                {k.label}
              </Chip>
            ))}
          </div>
        </div>

        {data.rows.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={MagnifyingGlassIcon}
              title="Nothing matches"
              description="No categories fit this search and these filters."
              action={
                <Link href="/admin/categories" className={BUTTON.secondary}>
                  Clear filters
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon={FoldersIcon}
              title="No categories yet"
              description="Categories group products in the shop menu and on category pages."
              action={
                <Link href="/admin/categories/new" className={BUTTON.primary}>
                  New category
                </Link>
              }
            />
          )
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Category</Th>
                  <Th>Kind</Th>
                  <Th>Parent</Th>
                  <Th className="text-right">Products</Th>
                  <Th className="text-right">Order</Th>
                  <Th>Visible</Th>
                  <Th>Homepage</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.rows.map((row) => (
                  <tr key={row.id} className="group transition-colors hover:bg-surface-2/40">
                    <Td>
                      <Link href={`/admin/categories/${row.id}`} className="flex min-w-0 items-center gap-3">
                        <Thumb row={row} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium group-hover:text-primary-ink">{row.name}</span>
                          <code className="block truncate text-xs text-muted-foreground">{row.slug}</code>
                        </span>
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{kindLabel(row.kind)}</Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{row.parent ?? "-"}</Td>
                    <Td className="text-right font-mono tabular-nums">{row.products.toLocaleString("en-AU")}</Td>
                    <Td className="text-right font-mono tabular-nums text-muted-foreground">{row.sortOrder}</Td>
                    <Td>
                      <FlagSwitch id={row.id} flag="isVisible" value={row.isVisible} label={`Show ${row.name} in the store`} />
                    </Td>
                    <Td>
                      <FlagSwitch id={row.id} flag="isFeatured" value={row.isFeatured} label={`Feature ${row.name} on the homepage`} />
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1 opacity-60 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                        <Link href={`/admin/categories/${row.id}`} aria-label={`Edit ${row.name}`} className={BUTTON.icon}>
                          <PencilSimpleIcon className="size-4" />
                        </Link>
                        {row.isVisible && (
                          <a href={`/product-category/${row.slug}`} target="_blank" rel="noreferrer" aria-label={`View ${row.name} in the store`} className={BUTTON.icon}>
                            <ArrowSquareOutIcon className="size-4" />
                          </a>
                        )}
                        {canDelete && <ConfirmDelete name={row.name} kind="category" action={deleteCategory.bind(null, row.id)} />}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <MobileList>
              {data.rows.map((row) => (
                <li key={row.id}>
                  <Link href={`/admin/categories/${row.id}`} className="flex items-center gap-3.5 px-4 pt-4 pb-3">
                    <Thumb row={row} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{row.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {kindLabel(row.kind)}
                        {row.parent && ` · in ${row.parent}`}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-mono text-lg tabular-nums">{row.products.toLocaleString("en-AU")}</span>
                      <span className="block text-xs text-muted-foreground">products</span>
                    </span>
                  </Link>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 pb-3 text-sm">
                    <span className="flex items-center gap-2">
                      <FlagSwitch id={row.id} flag="isVisible" value={row.isVisible} label={`Show ${row.name} in the store`} /> Visible
                    </span>
                    <span className="flex items-center gap-2">
                      <FlagSwitch id={row.id} flag="isFeatured" value={row.isFeatured} label={`Feature ${row.name} on the homepage`} /> Homepage
                    </span>
                    {!row.isVisible && <StatusPill status="hidden" />}
                  </div>
                  <div className="flex divide-x divide-border border-t border-border">
                    <Link href={`/admin/categories/${row.id}`} className="flex min-h-11 flex-1 items-center justify-center gap-2 text-sm font-medium hover:bg-surface-2/50">
                      <PencilSimpleIcon className="size-4" aria-hidden /> Edit
                    </Link>
                    {row.isVisible && (
                      <a href={`/product-category/${row.slug}`} target="_blank" rel="noreferrer" className="flex min-h-11 flex-1 items-center justify-center gap-2 text-sm font-medium hover:bg-surface-2/50">
                        <ArrowSquareOutIcon className="size-4" aria-hidden /> View
                      </a>
                    )}
                    {canDelete && <ConfirmDelete name={row.name} kind="category" action={deleteCategory.bind(null, row.id)} variant="bar" />}
                  </div>
                </li>
              ))}
            </MobileList>
            <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">
              {data.rows.length} {data.rows.length === 1 ? "category" : "categories"}. Lower order numbers show first.
            </p>
          </>
        )}
      </Card>
    </>
  );
}

export default function AdminCategoriesPage({ searchParams }: PageProps<"/admin/categories">) {
  return (
    <Suspense fallback={<ListSkeleton tiles={4} />}>
      <CategoriesView searchParams={searchParams} />
    </Suspense>
  );
}
