"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { fail, ok, toActionError, type ActionResult } from "@/lib/admin/result";
import { markEnquiry } from "@/lib/enquiries";

const input = z.object({ id: z.string().min(1).max(40), done: z.boolean() });

/** Marks an enquiry done, or moves it back to new. Any team member can. */
export async function setEnquiryDone(raw: z.input<typeof input>): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = input.safeParse(raw);
    if (!parsed.success) return fail("That enquiry couldn't be updated.");
    await markEnquiry(parsed.data.id, parsed.data.done);
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}
