// Order editing rules for the admin. Customer details reuse the checkout's own rules and messages.
import { z } from "zod";

export const ORDER_STATUSES = ["pending_payment", "paid", "processing", "shipped", "delivered", "cancelled"] as const;
export type OrderStatusInput = (typeof ORDER_STATUSES)[number];

export const orderLineSchema = z.object({
  id: z.string().max(40).optional(),
  productId: z.string().max(40).nullable().optional(),
  name: z.string().trim().min(1, "Give the item a name").max(200, "Keep the name under 200 characters"),
  quantity: z.number().int("Whole numbers only").min(1, "At least 1").max(99, "At most 99"),
  unitPriceCents: z.number().int().min(0, "Price can't be negative").max(1_000_000, "Over $10,000 looks like a typo"),
});

export const orderLinesSchema = z.array(orderLineSchema).min(1, "An order needs at least one item").max(50, "Keep it under 50 lines");

export type OrderLineInput = z.input<typeof orderLineSchema>;
