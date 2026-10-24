import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { InvoicePage } from "@/components/invoice/invoice-page";
import { prisma } from "@/lib/db";
import { invoiceStatus } from "@/lib/invoices/rules";
import type { InvoiceSnapshot } from "@/lib/invoices/types";

export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } };

/** The customer's invoice, behind the same private link as their order page. `?v=2` shows an earlier or later version. */
async function CustomerInvoice({ params, searchParams }: PageProps<"/invoice/[token]">) {
  await connection();
  const { token } = await params;
  const v = Number((await searchParams).v);
  if (!/^[\w-]{20,40}$/.test(token)) notFound();
  const order = await prisma.order.findUnique({
    where: { publicToken: token },
    select: { status: true, invoices: { orderBy: { version: "desc" }, select: { version: true, snapshot: true } } },
  });
  const latest = order?.invoices[0];
  const invoice = Number.isInteger(v) && v > 0 ? order?.invoices.find((i) => i.version === v) : latest;
  if (!order || !latest || !invoice) notFound();
  return (
    <InvoicePage
      snapshot={invoice.snapshot as InvoiceSnapshot}
      status={invoiceStatus(order.status, invoice.version === latest.version)}
      backHref={`/order/${token}`}
      backLabel="Back to your order"
    />
  );
}

export default function Page(props: PageProps<"/invoice/[token]">) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-[#e9ebef] dark:bg-background" aria-label="Loading invoice" />}>
      <CustomerInvoice {...props} />
    </Suspense>
  );
}
