"use client";

import { PrinterIcon } from "@phosphor-icons/react";

/** Opens the browser's print dialog, where "Save as PDF" is one of the printers. Hidden in print. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98] print:hidden"
    >
      <PrinterIcon className="size-4" aria-hidden />
      Print or save as PDF
    </button>
  );
}
