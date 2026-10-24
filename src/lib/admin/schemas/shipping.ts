// Shipping settings rules shared by the form and the server action.
import { z } from "zod";

export const shippingMethodSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2, "Give this option a name").max(60, "Keep the name under 60 characters"),
  description: z
    .string()
    .trim()
    .max(160, "Keep this under 160 characters")
    .transform((v) => v || null),
  priceCents: z.number().int().min(0, "Price can't be negative").max(100_000, "Shipping over $1,000 looks like a typo"),
  isActive: z.boolean(),
});

export const shippingSettingsSchema = z
  .array(shippingMethodSchema)
  .min(1)
  .max(10)
  .refine((methods) => methods.some((m) => m.isActive), "Keep at least one shipping option on, or customers can't check out");

export type ShippingMethodInput = z.input<typeof shippingMethodSchema>;
