import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { InvoicePage } from "@/components/invoice/invoice-page";
import { requireAdminPage } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { invoiceStatus } from "@/lib/invoices/rules";
import type { InvoiceSnapshot } from "@/lib/invoices/types";

export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } };

/** Any version of an order's invoice, for the team. Outside the admin shell so it prints cleanly. */
async function AdminInvoice({ params }: PageProps<"/admin/invoice/[orderId]/[version]">) {
  await requireAdminPage();
  const { orderId, version } = await params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, invoices: { orderBy: { version: "desc" }, select: { version: true, snapshot: true } } },
  });
  const invoice = order?.invoices.find((i) => i.version === Number(version));
  if (!order || !invoice) notFound();
  return (
    <InvoicePage
      snapshot={invoice.snapshot as InvoiceSnapshot}
      status={invoiceStatus(order.status, invoice.version === order.invoices[0]!.version)}
      backHref={`/admin/orders/${orderId}`}
      backLabel="Back to the order"
    />
  );
}

export default function Page(props: PageProps<"/admin/invoice/[orderId]/[version]">) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-[#e9ebef] dark:bg-background" aria-label="Loading invoice" />}>
      <AdminInvoice {...props} />
    </Suspense>
  );
}
