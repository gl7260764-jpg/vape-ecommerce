// How order statuses look in the admin. Client-safe.
import type { Tone } from "@/components/admin/ui/primitives";
import { ORDER_STATUS_LABEL } from "@/lib/invoices/rules";
import type { OrderStatusValue } from "@/lib/invoices/types";

export const ORDER_STATUS_TONE: Record<OrderStatusValue, Tone> = {
  pending_payment: "warning",
  paid: "info",
  processing: "info",
  shipped: "info",
  delivered: "success",
  cancelled: "danger",
};

export const orderStatusPill = (status: string) => ({
  label: ORDER_STATUS_LABEL[status as OrderStatusValue] ?? status,
  tone: ORDER_STATUS_TONE[status as OrderStatusValue] ?? ("neutral" as Tone),
});
