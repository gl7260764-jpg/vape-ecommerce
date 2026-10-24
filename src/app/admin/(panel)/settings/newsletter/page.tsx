import type { Metadata } from "next";
import { Suspense } from "react";
import { NewsletterForm } from "@/components/admin/settings/newsletter-form";
import { PageHeader } from "@/components/admin/ui/primitives";
import { EditorSkeleton } from "@/components/admin/ui/skeletons";
import { requireAdminPage } from "@/lib/admin/auth";
import { getNewsletterSettings } from "@/lib/newsletter";

export const metadata: Metadata = { title: "Newsletter pop-up" };

async function Settings() {
  await requireAdminPage("settings:write"); // owner only
  const s = await getNewsletterSettings();
  return (
    <NewsletterForm
      initial={{
        popupEnabled: s.popupEnabled,
        installOffersEnabled: s.installOffersEnabled,
        firstDelaySeconds: String(s.firstDelaySeconds),
        repeatEverySeconds: String(s.repeatEverySeconds),
        mode: s.maxShows === null ? "forever" : "times",
        maxShows: String(s.maxShows ?? 5),
      }}
    />
  );
}

export default function NewsletterSettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Newsletter pop-up"
        description="The pop-up that offers 10% off the next order for subscribing. Choose when it first appears and how often it comes back."
      />
      <Suspense fallback={<EditorSkeleton />}>
        <Settings />
      </Suspense>
    </>
  );
}
