"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { clientIpFrom } from "@/lib/analytics/geo";
import { createEnquiry, notifyEnquiry } from "@/lib/enquiries";
import { enquiryLimiter } from "@/lib/rate-limit";

const enquirySchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80, "Keep your name under 80 characters"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Enter a valid email, like name@example.com")
    .refine((v) => z.email().safeParse(v).success, "Enter a valid email, like name@example.com"),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || /^[+()\d\s-]{6,30}$/.test(v), "Enter a phone number, or leave it empty"),
  message: z.string().trim().min(1, "Type your message").max(2000, "Keep it under 2,000 characters"),
});

export type EnquiryInput = z.input<typeof enquirySchema> & { website?: string };
export type EnquiryResult = { ok: true; firstName: string } | { ok: false; error?: string; fieldErrors?: Record<string, string> };

/**
 * The contact page's form. Saved for Admin › Enquiries; the phone alert and the email go after the
 * response. `website` is a field people never see: a bot that fills it is told it worked and nothing is saved.
 */
export async function sendEnquiry(input: EnquiryInput): Promise<EnquiryResult> {
  const parsed = enquirySchema.safeParse({ name: input?.name ?? "", email: input?.email ?? "", phone: input?.phone ?? "", message: input?.message ?? "" });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, fieldErrors };
  }
  const firstName = parsed.data.name.split(/\s+/)[0];
  if (input.website) return { ok: true, firstName };

  try {
    const ip = clientIpFrom(await headers()) ?? "unknown";
    if (await enquiryLimiter.isLimited(ip, parsed.data.email)) return { ok: false, error: "Too many messages. Wait 15 minutes, then try again." };
    await enquiryLimiter.record(ip, parsed.data.email);
    const { id } = await createEnquiry({ ...parsed.data, phone: parsed.data.phone || null });
    after(() => notifyEnquiry(id));
    return { ok: true, firstName };
  } catch (error) {
    console.error("enquiry failed", error);
    return { ok: false, error: "We couldn't send that just now. Please try again, or email us." };
  }
}
