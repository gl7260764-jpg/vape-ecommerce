import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowSquareOutIcon, MagnifyingGlassIcon, PencilSimpleIcon, PlusIcon, TrademarkIcon } from "@phosphor-icons/react/dist/ssr";
import { deleteBrand } from "@/app/actions/admin/taxonomy";
import { ConfirmDelete } from "@/components/admin/ui/confirm-delete";
import { BUTTON, Card, EmptyState, MobileList, PageHeader, Table, Td, Th } from "@/components/admin/ui/primitives";
import { SearchBox } from "@/components/admin/ui/search-box";
import { ListSkeleton } from "@/components/admin/ui/skeletons";
import { can, requireAdminPage } from "@/lib/admin/auth";
import { formatDate } from "@/lib/admin/format";
import { listAdminBrands } from "@/lib/admin/queries/taxonomy";

export const metadata: Metadata = { title: "Brands" };

async function BrandsView({ searchParams }: Pick<PageProps<"/admin/brands">, "searchParams">) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().slice(0, 100) ?? "";
  const admin = await requireAdminPage();
  const rows = await listAdminBrands(q);
  const canDelete = can(admin.role, "catalog:delete");

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Brands"
        description="A brand gets its own page in the store once it has live products."
        actions={
          <Link href="/admin/brands/new" className={BUTTON.primary}>
            <PlusIcon weight="bold" className="size-4" aria-hidden />
            <span className="sm:hidden">New</span>
            <span className="hidden sm:inline">New brand</span>
          </Link>
        }
      />

      <Card className="mt-8">
        <div className="border-b border-border p-4">
          <SearchBox placeholder="Search brands" className="lg:w-80" />
        </div>

        {rows.length === 0 ? (
          q ? (
            <EmptyState
              icon={MagnifyingGlassIcon}
              title="Nothing matches"
              description={`No brand matches "${q}".`}
              action={
                <Link href="/admin/brands" className={BUTTON.secondary}>
                  Clear search
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon={TrademarkIcon}
              title="No brands yet"
              description="Add a brand, then pick it on products."
              action={
                <Link href="/admin/brands/new" className={BUTTON.primary}>
                  New brand
                </Link>
              }
            />
          )
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Brand</Th>
                  <Th className="text-right">Live products</Th>
                  <Th className="text-right">All products</Th>
                  <Th className="text-right">Ranges</Th>
                  <Th>Edited</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.id} className="group transition-colors hover:bg-surface-2/40">
                    <Td>
                      <Link href={`/admin/brands/${row.id}`} className="block min-w-0">
                        <span className="block font-medium group-hover:text-primary-ink">{row.name}</span>
                        <code className="block text-xs text-muted-foreground">{row.slug}</code>
                      </Link>
                    </Td>
                    <Td className="text-right font-mono tabular-nums">
                      <Link href={`/admin/products?brand=${row.slug}&view=active`} className="hover:text-primary-ink">
                        {row.live.toLocaleString("en-AU")}
                      </Link>
                    </Td>
                    <Td className="text-right font-mono tabular-nums text-muted-foreground">{row.products.toLocaleString("en-AU")}</Td>
                    <Td className="text-right font-mono tabular-nums text-muted-foreground">{row.categories}</Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{formatDate(row.updatedAt)}</Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1 opacity-60 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                        <Link href={`/admin/brands/${row.id}`} aria-label={`Edit ${row.name}`} className={BUTTON.icon}>
                          <PencilSimpleIcon className="size-4" />
                        </Link>
                        {row.live > 0 && (
                          <a href={`/brand/${row.slug}`} target="_blank" rel="noreferrer" aria-label={`View ${row.name} in the store`} className={BUTTON.icon}>
                            <ArrowSquareOutIcon className="size-4" />
                          </a>
                        )}
                        {canDelete && <ConfirmDelete name={row.name} kind="brand" action={deleteBrand.bind(null, row.id)} />}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <MobileList>
              {rows.map((row) => (
                <li key={row.id}>
                  <Link href={`/admin/brands/${row.id}`} className="flex items-center justify-between gap-4 px-4 pt-4 pb-3">
                    <span className="min-w-0">
                      <span className="block font-medium">{row.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {row.categories} {row.categories === 1 ? "range" : "ranges"} · {row.products.toLocaleString("en-AU")} products in total
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-mono text-lg tabular-nums">{row.live.toLocaleString("en-AU")}</span>
                      <span className="block text-xs text-muted-foreground">live</span>
                    </span>
                  </Link>
                  <div className="flex divide-x divide-border border-t border-border">
                    <Link href={`/admin/brands/${row.id}`} className="flex min-h-11 flex-1 items-center justify-center gap-2 text-sm font-medium hover:bg-surface-2/50">
                      <PencilSimpleIcon className="size-4" aria-hidden /> Edit
                    </Link>
                    {canDelete && <ConfirmDelete name={row.name} kind="brand" action={deleteBrand.bind(null, row.id)} variant="bar" />}
                  </div>
                </li>
              ))}
            </MobileList>
            <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">
              {rows.length} {rows.length === 1 ? "brand" : "brands"}
            </p>
          </>
        )}
      </Card>
    </>
  );
}

export default function AdminBrandsPage({ searchParams }: PageProps<"/admin/brands">) {
  return (
    <Suspense fallback={<ListSkeleton tiles={0} />}>
      <BrandsView searchParams={searchParams} />
    </Suspense>
  );
}
