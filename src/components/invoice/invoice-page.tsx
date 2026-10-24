import Link from "next/link";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr";
import { InvoiceDocument } from "@/components/invoice/invoice-document";
import { PrintButton } from "@/components/invoice/print-button";
import type { InvoiceSnapshot, InvoiceStatus } from "@/lib/invoices/types";

/** The full invoice on its own page: a back link and the print button above it, nothing else when printed. */
export function InvoicePage({ snapshot, status, backHref, backLabel }: { snapshot: InvoiceSnapshot; status: InvoiceStatus; backHref: string; backLabel: string }) {
  return (
    <main className="min-h-dvh bg-[#e9ebef] pb-12 text-foreground sm:px-6 sm:pt-8 dark:bg-background print:bg-white print:p-0">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-0 sm:pt-0 print:hidden">
          <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-medium text-[#3b3f48] hover:text-[#15171c] dark:text-muted-foreground dark:hover:text-foreground">
            <ArrowLeftIcon className="size-4" aria-hidden />
            {backLabel}
          </Link>
          <PrintButton />
        </div>
        <InvoiceDocument snapshot={snapshot} status={status} layout="page" />
      </div>
    </main>
  );
}
