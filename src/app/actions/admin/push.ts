"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { fail, ok, toActionError, type ActionResult } from "@/lib/admin/result";
import { pushConfigured } from "@/lib/push";
import { broadcastProduct } from "@/lib/push-broadcast";

const pushInput = z.object({
  productId: z.string().min(1).max(40),
  title: z.string().trim().min(1, "Add a title").max(60, "Keep the title under 60 characters"),
  body: z.string().trim().min(1, "Add a message").max(160, "Keep the message under 160 characters"),
});

/** Admin › Push notifications: sends a product to every device with notifications on. Owner only. */
export async function sendProductPush(input: z.input<typeof pushInput>): Promise<ActionResult<{ sent: number }>> {
  try {
    const admin = await requireAdmin("settings:write");
    if (!pushConfigured) return fail("Notifications aren't set up yet: add the two VAPID settings.");
    const parsed = pushInput.safeParse(input);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
      return fail("Some fields need attention.", errors);
    }
    return ok(await broadcastProduct({ ...parsed.data, sentById: admin.id }));
  } catch (error) {
    return toActionError(error);
  }
}
