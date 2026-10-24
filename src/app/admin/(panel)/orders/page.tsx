import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MagnifyingGlassIcon, ReceiptIcon } from "@phosphor-icons/react/dist/ssr";
import { BUTTON, Card, Chip, EmptyState, MobileList, PageHeader, Pagination, StatusPill, Table, Td, Th } from "@/components/admin/ui/primitives";
import { SearchBox } from "@/components/admin/ui/search-box";
import { ListSkeleton } from "@/components/admin/ui/skeletons";
import { requireAdminPage } from "@/lib/admin/auth";
import { formatDateTime } from "@/lib/admin/format";
import { orderStatusPill } from "@/lib/admin/order-status";
import { listAdminOrders, ORDER_PAGE_SIZE, orderListHref, parseOrderParams } from "@/lib/admin/queries/orders";
import { ORDER_STATUSES } from "@/lib/admin/schemas/order";
import { formatPrice } from "@/lib/catalog";
import { orderNumber } from "@/lib/checkout";

export const metadata: Metadata = { title: "Orders" };

async function OrdersView({ searchParams }: Pick<PageProps<"/admin/orders">, "searchParams">) {
  await requireAdminPage();
  const params = parseOrderParams(await searchParams);
  const data = await listAdminOrders(params);
  const filtered = Boolean(params.q || params.status);

  return (
    <>
      <PageHeader eyebrow="Sales" title="Orders" description="Every order, newest first. Open one to fix its details and send the customer a corrected invoice." />

      <Card className="mt-8">
        <div className="flex flex-col gap-3 border-b border-border p-4">
          <SearchBox placeholder="Search orders by number, name or email" className="lg:w-96" />
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            <Chip href={orderListHref(params, { status: "" })} active={!params.status} count={data.all}>
              All
            </Chip>
            {ORDER_STATUSES.map((s) => (
              <Chip key={s} href={orderListHref(params, { status: s })} active={params.status === s} count={data.counts[s]}>
                {orderStatusPill(s).label}
              </Chip>
            ))}
          </div>
        </div>

        {data.rows.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={MagnifyingGlassIcon}
              title="No orders match"
              description="Try another order number, name or email, or another status."
              action={
                <Link href="/admin/orders" className={BUTTON.secondary}>
                  Clear filters
                </Link>
              }
            />
          ) : (
            <EmptyState icon={ReceiptIcon} title="No orders yet" description="Orders placed on the store appear here." />
          )
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Total</Th>
                  <Th>Placed</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.rows.map((o) => {
                  const pill = orderStatusPill(o.status);
                  return (
                    <tr key={o.id} className="transition-colors hover:bg-surface-2/40">
                      <Td>
                        <Link href={`/admin/orders/${o.id}`} className="font-mono font-medium hover:text-primary-ink">
                          {orderNumber(o.number)}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {o._count.items} {o._count.items === 1 ? "item" : "items"}
                        </span>
                      </Td>
                      <Td>
                        <span className="block font-medium">{o.fullName}</span>
                        <span className="block text-xs break-all text-muted-foreground">{o.email}</span>
                      </Td>
                      <Td>
                        <StatusPill label={pill.label} tone={pill.tone} />
                      </Td>
                      <Td className="text-right font-mono tabular-nums">{formatPrice(o.totalCents / 100)}</Td>
                      <Td className="whitespace-nowrap text-muted-foreground">{formatDateTime(o.createdAt)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>

            <MobileList>
              {data.rows.map((o) => {
                const pill = orderStatusPill(o.status);
                return (
                  <li key={o.id}>
                    <Link href={`/admin/orders/${o.id}`} className="block px-4 py-3.5 hover:bg-surface-2/50">
                      <span className="flex items-center justify-between gap-3">
                        <span className="font-mono font-medium">{orderNumber(o.number)}</span>
                        <StatusPill label={pill.label} tone={pill.tone} />
                      </span>
                      <span className="mt-1 flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate">{o.fullName}</span>
                        <span className="shrink-0 font-mono tabular-nums">{formatPrice(o.totalCents / 100)}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</span>
                    </Link>
                  </li>
                );
              })}
            </MobileList>

            <Pagination page={params.page} pageCount={data.pageCount} total={data.total} pageSize={ORDER_PAGE_SIZE} href={(page) => orderListHref(params, { page })} />
          </>
        )}
      </Card>
    </>
  );
}

export default function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <Suspense fallback={<ListSkeleton tiles={0} />}>
      <OrdersView searchParams={searchParams} />
    </Suspense>
  );
}
