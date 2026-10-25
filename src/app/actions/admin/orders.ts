"use server";

import { after } from "next/server";
import { notifyOrder } from "@/lib/push";
import { requireAdmin } from "@/lib/admin/auth";
import { fail, ok, toActionError, type ActionResult } from "@/lib/admin/result";
import { searchOrderProducts, type OrderProductOption } from "@/lib/admin/queries/orders";
import { ORDER_STATUSES, type OrderStatusInput } from "@/lib/admin/schemas/order";
import { issueInvoice } from "@/lib/chat/service";
import { changeOrderStatus, updateOrder, type OrderEditInput } from "@/lib/orders/edit";

// Orders in the admin: fix the details, change the status, send the corrected invoice to the chat.

export async function saveOrder(id: string, input: OrderEditInput): Promise<ActionResult<null>> {
  try {
    await requireAdmin("orders:write");
    const result = await updateOrder(String(id), input);
    return result.ok ? ok(null) : fail(result.error, result.fieldErrors);
  } catch (error) {
    return toActionError(error);
  }
}

export async function setOrderStatus(id: string, status: string): Promise<ActionResult<null>> {
  try {
    const admin = await requireAdmin("orders:write");
    if (!(ORDER_STATUSES as readonly string[]).includes(status)) return fail("Choose a status from the list.");
    const changed = await changeOrderStatus(String(id), status as OrderStatusInput, admin.id);
    // The customer's device hears about payment, shipping and delivery (if they turned notifications on).
    if (changed && (status === "paid" || status === "shipped" || status === "delivered")) {
      after(() => notifyOrder(String(id), status).catch((error) => console.error("order notification failed", error)));
    }
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

/** A new invoice from the order as saved; into the chat when the order has one, otherwise issued on the order page. */
export async function sendOrderInvoice(id: string): Promise<ActionResult<{ number: string; posted: boolean }>> {
  try {
    const admin = await requireAdmin("orders:write");
    return ok(await issueInvoice(String(id), admin.id));
  } catch (error) {
    return toActionError(error);
  }
}

export async function findOrderProducts(q: string): Promise<ActionResult<OrderProductOption[]>> {
  try {
    await requireAdmin("orders:write");
    return ok(await searchOrderProducts(String(q)));
  } catch (error) {
    return toActionError(error);
  }
}
