import type { Metadata } from "next";
import { Suspense } from "react";
import { BellRingingIcon, PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/ssr";
import { ProductPushList } from "@/components/admin/push/product-push-list";
import { Card, EmptyState, PageHeader, StatTile } from "@/components/admin/ui/primitives";
import { SearchBox } from "@/components/admin/ui/search-box";
import { ListSkeleton } from "@/components/admin/ui/skeletons";
import { requireAdminPage } from "@/lib/admin/auth";
import { pushOverview, pushProducts } from "@/lib/admin/queries/push";
import { timeAgo } from "@/lib/admin/time";
import { pushConfigured } from "@/lib/push";

export const metadata: Metadata = { title: "Push notifications" };
// The send runs in this page's server action: a minute covers a few thousand devices.
export const maxDuration = 60;

async function PushView({ searchParams }: Pick<PageProps<"/admin/push">, "searchParams">) {
  await requireAdminPage("settings:write"); // owner only
  const q = [(await searchParams).q].flat()[0] ?? "";
  const [overview, products] = await Promise.all([pushOverview(), pushProducts(q)]);

  return (
    <>
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Notifications on" value={overview.devices} icon={BellRingingIcon} tone="brand" />
        <StatTile label="Pushes sent" value={overview.sent} icon={PaperPlaneTiltIcon} />
      </div>
      {!pushConfigured && (
        <p className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Notifications aren&apos;t set up yet: add NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to the site&apos;s settings.
        </p>
      )}

      <Card className="mt-6">
        <div className="flex flex-col gap-2 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchBox placeholder="Search products" className="sm:w-80" />
          <p className="text-sm text-muted-foreground">{overview.lastSentAt ? `Last sent ${timeAgo(overview.lastSentAt)}` : "Nothing sent yet"}</p>
        </div>
        {products.length ? (
          <ProductPushList products={products} devices={overview.devices} configured={pushConfigured} />
        ) : (
          <EmptyState icon={BellRingingIcon} title="No products match" description="Try another name." />
        )}
      </Card>

      <Card className="mt-6" role="region" aria-label="Sent">
        <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">Sent</h2>
        {overview.history.length ? (
          <ul className="divide-y divide-border">
            {overview.history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="block font-medium">{h.product?.name ?? "A removed product"}</span>
                  <span className="block text-xs text-muted-foreground">
                    &ldquo;{h.title}&rdquo;{h.sentBy ? ` · by ${h.sentBy.name}` : ""}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {h.sentCount} delivered · {timeAgo(h.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-sm text-muted-foreground">Pushes you send show here.</p>
        )}
      </Card>
    </>
  );
}

export default function PushPage({ searchParams }: PageProps<"/admin/push">) {
  return (
    <>
      <PageHeader eyebrow="Marketing" title="Push notifications" description="Send a product to everyone who turned notifications on. Tapping it opens the product." />
      <Suspense fallback={<ListSkeleton />}>
        <PushView searchParams={searchParams} />
      </Suspense>
    </>
  );
}
