import type { Metadata } from "next";
import { Suspense } from "react";
import { AlertsForm } from "@/components/admin/settings/alerts-form";
import { PageHeader } from "@/components/admin/ui/primitives";
import { EditorSkeleton } from "@/components/admin/ui/skeletons";
import { requireAdminPage } from "@/lib/admin/auth";
import { getAlertTopic } from "@/lib/alerts";

export const metadata: Metadata = { title: "Phone alerts" };

async function Alerts() {
  await requireAdminPage("settings:write"); // owner only
  return <AlertsForm initial={(await getAlertTopic()) ?? ""} />;
}

export default function AlertsSettingsPage() {
  return (
    <>
      <PageHeader eyebrow="Settings" title="Phone alerts" description="New orders, customer messages and new subscribers on your phone, with the free ntfy app. Tap one to open it here." />
      <Suspense fallback={<EditorSkeleton />}>
        <Alerts />
      </Suspense>
    </>
  );
}
