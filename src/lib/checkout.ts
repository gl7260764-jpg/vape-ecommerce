// Checkout rules shared by the form (instant feedback) and the server action (the real check).
import { z } from "zod";

export const AU_STATES = [
  { code: "NSW", name: "New South Wales" },
  { code: "VIC", name: "Victoria" },
  { code: "QLD", name: "Queensland" },
  { code: "WA", name: "Western Australia" },
  { code: "SA", name: "South Australia" },
  { code: "TAS", name: "Tasmania" },
  { code: "ACT", name: "Australian Capital Territory" },
  { code: "NT", name: "Northern Territory" },
] as const;
export type AuStateCode = (typeof AU_STATES)[number]["code"];
const STATE_CODES = AU_STATES.map((s) => s.code) as [AuStateCode, ...AuStateCode[]];

/** Australia Post postcode ranges per state and territory. */
const POSTCODE_RANGES: Record<AuStateCode, [number, number][]> = {
  NSW: [[1000, 2599], [2619, 2899], [2921, 2999]],
  ACT: [[200, 299], [2600, 2618], [2900, 2920]],
  VIC: [[3000, 3999], [8000, 8999]],
  QLD: [[4000, 4999], [9000, 9999]],
  SA: [[5000, 5999]],
  WA: [[6000, 6999]],
  TAS: [[7000, 7999]],
  NT: [[800, 999]],
};
export const postcodeMatchesState = (postcode: string, state: AuStateCode) => {
  const n = Number(postcode);
  return POSTCODE_RANGES[state].some(([lo, hi]) => n >= lo && n <= hi);
};

/**
 * Accepts the ways Australians write numbers ("0412 345 678", "+61 412 345 678", "(02) 9876 5432")
 * and returns E.164 (+61412345678), or null if it isn't a valid mobile or landline.
 */
export function normaliseAuPhone(input: string): string | null {
  let n = input.replace(/[^\d+]/g, "");
  if (n.startsWith("+61")) n = `0${n.slice(3)}`;
  else if (n.startsWith("61") && n.length === 11) n = `0${n.slice(2)}`;
  if (!/^0[23478]\d{8}$/.test(n)) return null;
  return `+61${n.slice(1)}`;
}

/** +61412345678 -> "0412 345 678"; +61298765432 -> "(02) 9876 5432". */
export function formatAuPhone(e164: string) {
  const local = `0${e164.replace(/^\+61/, "")}`;
  return local.startsWith("04")
    ? `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`
    : `(${local.slice(0, 2)}) ${local.slice(2, 6)} ${local.slice(6)}`;
}

export const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank transfer", phrase: "bank transfer", detail: "Pay from your bank using BSB and account number." },
  { value: "payid", label: "PayID", phrase: "PayID", detail: "Fast transfer to our email or phone PayID." },
] as const;
export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number]["value"];
export const paymentLabel = (v: string) => PAYMENT_METHODS.find((p) => p.value === v)?.label ?? v;
/** Mid-sentence form: "the bank transfer details", "the PayID details". */
export const paymentPhrase = (v: string) => PAYMENT_METHODS.find((p) => p.value === v)?.phrase ?? v;

export const checkoutSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name").max(120, "That name is too long"),
    email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
    phone: z.string().trim().refine((v) => normaliseAuPhone(v) !== null, "Enter an Australian number, like 0412 345 678"),
    addressLine1: z.string().trim().min(3, "Enter your street address").max(200),
    addressLine2: z.string().trim().max(200).optional(),
    suburb: z.string().trim().min(2, "Enter your suburb").max(100),
    state: z.enum(STATE_CODES, "Choose your state or territory"),
    postcode: z.string().trim().regex(/^\d{4}$/, "Enter a 4-digit postcode"),
    shipping: z.string().min(1, "Choose a shipping option"),
    payment: z.enum(["bank_transfer", "payid"], "Choose how you'd like to pay"),
    notes: z.string().trim().max(500, "Keep notes under 500 characters").optional(),
  })
  .superRefine((d, ctx) => {
    if (/^\d{4}$/.test(d.postcode) && !postcodeMatchesState(d.postcode, d.state)) {
      const name = AU_STATES.find((s) => s.code === d.state)?.name;
      ctx.addIssue({ code: "custom", path: ["postcode"], message: `That postcode isn't in ${name}` });
    }
  });

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type FieldErrors = Partial<Record<keyof CheckoutInput, string>>;
/** Raw form values as the browser sends them; nothing is trusted until validateCheckout passes. */
export type CheckoutFormValues = Record<keyof CheckoutInput, string>;

/** First error per field, for showing under each input. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const flat = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
  return Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, v?.[0]])) as FieldErrors;
}

/**
 * Validates everything in one pass. zod skips cross-field checks while other fields are invalid,
 * so the postcode/state match is checked separately to report every problem at once.
 */
export function validateCheckout(input: Partial<CheckoutFormValues>) {
  const result = checkoutSchema.safeParse(input);
  if (result.success) return { ok: true as const, data: result.data };
  const errors = fieldErrors(result.error);
  const state = AU_STATES.find((s) => s.code === input.state);
  const postcode = String(input.postcode ?? "").trim();
  if (!errors.postcode && state && /^\d{4}$/.test(postcode) && !postcodeMatchesState(postcode, state.code)) {
    errors.postcode = `That postcode isn't in ${state.name}`;
  }
  return { ok: false as const, errors };
}

export type CartLineInput = { id: string; quantity: number };

export const orderNumber = (n: number) => `BV-${n}`;
