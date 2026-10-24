import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  FlagIcon,
  FoldersIcon,
  PackageIcon,
  PencilSimpleIcon,
  ProhibitIcon,
  TrademarkIcon,
  TruckIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { Card, PageHeader, StatTile } from "@/components/admin/ui/primitives";
import { ListSkeleton } from "@/components/admin/ui/skeletons";
import { can, requireAdmin, requireAdminPage } from "@/lib/admin/auth";
import { formatPrice } from "@/lib/catalog";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Dashboard" };

async function getOverview() {
  await requireAdmin();
  const [live, drafts, review, out, categories, brands, awaiting, shipping] = await Promise.all([
    prisma.product.count({ where: { status: "active" } }),
    prisma.product.count({ where: { status: "draft" } }),
    prisma.product.count({ where: { needsReview: true } }),
    prisma.product.count({ where: { status: "active", stockStatus: "out_of_stock" } }),
    prisma.category.count(),
    prisma.brand.count(),
    prisma.order.count({ where: { status: "pending_payment" } }),
    prisma.shippingMethod.findMany({ orderBy: { sortOrder: "asc" }, select: { name: true, priceCents: true, isActive: true } }),
  ]);
  return { live, drafts, review, out, categories, brands, awaiting, shipping };
}

function Shortcut({ href, icon: IconComp, title, detail }: { href: string; icon: Icon; title: string; detail: string }) {
  return (
    <Link href={href} className="group flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-foreground/25">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-2">
        <IconComp className="size-5 text-foreground/80" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block truncate text-sm text-muted-foreground">{detail}</span>
      </span>
      <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

async function Overview() {
  const admin = await requireAdminPage();
  const o = await getOverview();
  const shippingSummary = o.shipping.filter((s) => s.isActive).map((s) => `${s.name.replace(/ shipping$/i, "")} ${formatPrice(s.priceCents / 100)}`).join(" · ");

  return (
    <>
      <PageHeader eyebrow="Overview" title="Dashboard" description={`Welcome back, ${admin.name.split(" ")[0]}.`} />

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Awaiting payment" value={o.awaiting} icon={ClockIcon} tone={o.awaiting ? "warning" : "neutral"} />
        <StatTile label="Live products" value={o.live} icon={CheckCircleIcon} tone="success" href="/admin/products?view=active" />
        <StatTile label="Drafts" value={o.drafts} icon={PencilSimpleIcon} href="/admin/products?view=draft" />
        <StatTile label="Live but out of stock" value={o.out} icon={ProhibitIcon} tone={o.out ? "danger" : "neutral"} href="/admin/products?view=out" />
        <StatTile label="Need review" value={o.review} icon={FlagIcon} tone={o.review ? "warning" : "neutral"} href="/admin/products?view=review" />
      </div>

      <Card className="mt-6 p-5">
        <h2 className="text-sm font-semibold">Manage the store</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Shortcut href="/admin/products" icon={PackageIcon} title="Products" detail="Add, edit, price and photograph products" />
          <Shortcut href="/admin/categories" icon={FoldersIcon} title="Categories" detail={`${o.categories} categories, order and visibility`} />
          <Shortcut href="/admin/brands" icon={TrademarkIcon} title="Brands" detail={`${o.brands} brands`} />
          {can(admin.role, "settings:write") && (
            <Shortcut href="/admin/settings/shipping" icon={TruckIcon} title="Shipping" detail={shippingSummary || "Set delivery options and prices"} />
          )}
        </div>
      </Card>
    </>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<ListSkeleton tiles={4} />}>
      <Overview />
    </Suspense>
  );
}
