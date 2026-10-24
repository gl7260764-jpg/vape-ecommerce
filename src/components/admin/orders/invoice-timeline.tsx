import { formatDateTime } from "@/lib/admin/format";
import type { AdminOrder } from "@/lib/admin/queries/orders";
import { ORDER_STATUS_LABEL } from "@/lib/invoices/rules";
import { cn } from "@/lib/utils";

type Entry = { key: string; at: Date; title: string; detail: string; accent: boolean; href?: string };

/** Invoices sent, the customer's answers and status changes, oldest first, with who and when. */
export function InvoiceTimeline({ order }: { order: AdminOrder }) {
  const entries: Entry[] = [];
  for (const inv of order.invoices) {
    entries.push({
      key: `sent-${inv.id}`,
      at: inv.createdAt,
      title: `${inv.number} sent`,
      detail: inv.sentBy ? `by ${inv.sentBy.name}` : "automatically, with the order",
      accent: true,
      href: `/admin/invoice/${order.id}/${inv.version}`,
    });
    if (inv.answer && inv.answeredAt) {
      entries.push({
        key: `answer-${inv.id}`,
        at: inv.answeredAt,
        title: inv.answer === "confirmed" ? "Confirmed by the customer" : "The customer said something's wrong",
        detail: inv.number,
        accent: inv.answer === "confirmed",
      });
    }
  }
  for (const c of order.statusChanges) {
    entries.push({
      key: `status-${c.id}`,
      at: c.createdAt,
      title: `Status: ${ORDER_STATUS_LABEL[c.from]} to ${ORDER_STATUS_LABEL[c.to]}`,
      detail: c.admin ? `by ${c.admin.name}` : "",
      accent: false,
    });
  }
  entries.sort((a, b) => a.at.getTime() - b.at.getTime());

  if (!entries.length) return <p className="mt-3 text-sm text-muted-foreground">No invoice has been sent for this order yet.</p>;
  return (
    <ol aria-label="Invoice history" className="mt-4 ml-1.5 border-l-2 border-border pl-4">
      {entries.map((e) => (
        <li key={e.key} className="relative pb-4 last:pb-0">
          <span aria-hidden className={cn("absolute top-1 -left-[1.4rem] size-2.5 rounded-full", e.accent ? "bg-primary" : "bg-border")} />
          <p className="text-sm font-medium">
            {e.href ? (
              <a href={e.href} target="_blank" rel="noopener" className="hover:text-primary-ink hover:underline">
                {e.title}
              </a>
            ) : (
              e.title
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(e.at)}
            {e.detail && ` · ${e.detail}`}
          </p>
        </li>
      ))}
    </ol>
  );
}
