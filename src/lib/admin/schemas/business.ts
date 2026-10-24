// The store's details for the invoice header. Every field is optional; blank means "leave it off".
import { z } from "zod";
import { normaliseAuPhone } from "@/lib/checkout";

const blank = (v: string) => v.trim() === "";

export const businessSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => blank(v) || z.email().safeParse(v).success, "Enter a valid email address")
    .transform((v) => v || null),
  phone: z
    .string()
    .trim()
    .refine((v) => blank(v) || normaliseAuPhone(v) !== null, "Enter an Australian number, like 02 9000 0000 or 0412 345 678")
    .transform((v) => (v ? normaliseAuPhone(v) : null)),
  address: z
    .string()
    .trim()
    .max(300, "Keep the address under 300 characters")
    .transform((v) => v.replace(/\r\n?/g, "\n") || null),
  abn: z
    .string()
    .transform((v) => v.replace(/\s+/g, ""))
    .refine((v) => v === "" || /^\d{11}$/.test(v), "An ABN is 11 digits")
    .transform((v) => v || null),
});

export type BusinessInput = z.input<typeof businessSchema>;
