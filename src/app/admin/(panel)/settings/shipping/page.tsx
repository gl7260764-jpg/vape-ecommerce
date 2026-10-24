import type { Metadata } from "next";
import { Suspense } from "react";
import { ShippingForm } from "@/components/admin/settings/shipping-form";
import { PageHeader } from "@/components/admin/ui/primitives";
import { EditorSkeleton } from "@/components/admin/ui/skeletons";
import { requireAdmin, requireAdminPage } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Shipping" };

async function getShippingSettings() {
  await requireAdmin("settings:write");
  return prisma.shippingMethod.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, code: true, name: true, description: true, priceCents: true, isActive: true },
  });
}

async function Shipping() {
  await requireAdminPage("settings:write"); // owner only
  const methods = await getShippingSettings();
  return <ShippingForm methods={methods} />;
}

export default function ShippingSettingsPage() {
  return (
    <>
      <PageHeader eyebrow="Settings" title="Shipping" description="The delivery options and prices customers choose from at checkout." />
      <Suspense fallback={<EditorSkeleton />}>
        <Shipping />
      </Suspense>
    </>
  );
}
