import type { Metadata } from "next";
import { Suspense } from "react";
import { BusinessForm } from "@/components/admin/settings/business-form";
import { PageHeader } from "@/components/admin/ui/primitives";
import { EditorSkeleton } from "@/components/admin/ui/skeletons";
import { requireAdminPage } from "@/lib/admin/auth";
import { formatAuPhone } from "@/lib/checkout";
import { getStoreProfile } from "@/lib/store-profile";

export const metadata: Metadata = { title: "Business details" };

async function Business() {
  await requireAdminPage("settings:write"); // owner only
  const p = await getStoreProfile();
  return (
    <BusinessForm
      initial={{
        email: p.email ?? "",
        phone: p.phone ? (p.phone.startsWith("+61") ? formatAuPhone(p.phone) : p.phone) : "",
        address: p.address ?? "",
        abn: p.abn ? p.abn.replace(/^(\d{2})(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3 $4") : "",
      }}
    />
  );
}

export default function BusinessSettingsPage() {
  return (
    <>
      <PageHeader eyebrow="Settings" title="Business details" description="Your details at the top of every invoice. Leave a field blank to leave it off." />
      <Suspense fallback={<EditorSkeleton />}>
        <Business />
      </Suspense>
    </>
  );
}
