import type { Metadata } from "next";
import { Suspense } from "react";
import { EnvelopeOpenIcon, PhoneIcon } from "@phosphor-icons/react/dist/ssr";
import { EnquiryDoneButton } from "@/components/admin/enquiries/enquiry-done-button";
import { BUTTON, Card, EmptyState, PageHeader } from "@/components/admin/ui/primitives";
import { ListSkeleton } from "@/components/admin/ui/skeletons";
import { requireAdminPage } from "@/lib/admin/auth";
import { enquiryLists, type EnquiryRow } from "@/lib/admin/queries/enquiries";
import { timeAgo } from "@/lib/admin/time";

export const metadata: Metadata = { title: "Enquiries" };

function Enquiry({ e, done }: { e: EnquiryRow; done: boolean }) {
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">{e.name}</p>
        <p className="text-xs text-muted-foreground">{timeAgo(e.createdAt)}</p>
      </div>
      <p className="text-sm break-all text-muted-foreground">
        {e.email}
        {e.phone && ` · ${e.phone}`}
      </p>
      <p className="text-sm whitespace-pre-wrap">{e.message}</p>
      <div className="flex flex-wrap gap-2">
        <a href={`mailto:${e.email}?subject=${encodeURIComponent("Re: your enquiry")}`} className={BUTTON.primary}>
          <EnvelopeOpenIcon className="size-4" aria-hidden />
          Reply by email
        </a>
        {e.phone && (
          <a href={`tel:${e.phone.replace(/[^\d+]/g, "")}`} className={BUTTON.secondary}>
            <PhoneIcon className="size-4" aria-hidden />
            Call
          </a>
        )}
        <EnquiryDoneButton id={e.id} done={done} />
      </div>
    </li>
  );
}

async function Enquiries() {
  await requireAdminPage();
  const { open, done } = await enquiryLists();
  return (
    <>
      <Card className="mt-8" role="region" aria-label="New enquiries">
        <h2 className="border-b border-border px-4 py-3 text-sm font-semibold sm:px-5">New ({open.length})</h2>
        {open.length ? (
          <ul className="divide-y divide-border">
            {open.map((e) => (
              <Enquiry key={e.id} e={e} done={false} />
            ))}
          </ul>
        ) : (
          <EmptyState icon={EnvelopeOpenIcon} title="No new enquiries" description="Messages from the contact page show here." />
        )}
      </Card>
      {done.length > 0 && (
        <Card className="mt-6" role="region" aria-label="Done">
          <h2 className="border-b border-border px-4 py-3 text-sm font-semibold sm:px-5">Done</h2>
          <ul className="divide-y divide-border opacity-80">
            {done.map((e) => (
              <Enquiry key={e.id} e={e} done />
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

export default function EnquiriesPage() {
  return (
    <>
      <PageHeader eyebrow="Sales" title="Enquiries" description="Messages from the contact page. Reply by email or call, then mark them done." />
      <Suspense fallback={<ListSkeleton />}>
        <Enquiries />
      </Suspense>
    </>
  );
}
