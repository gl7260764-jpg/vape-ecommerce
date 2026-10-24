"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/auth";
import { fail, ok, toActionError, type ActionResult } from "@/lib/admin/result";
import type { DeleteOutcome } from "@/components/admin/ui/confirm-delete";

const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")).pipe(z.string().max(254));

/** Adds someone by hand (they asked in person or by message). Re-adding an existing address is not an error. */
export async function addSubscriber(email: string): Promise<ActionResult<{ created: boolean }>> {
  try {
    await requireAdmin();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Enter a valid email address", { email: "Enter a valid email address" });
    const existing = await prisma.subscriber.findUnique({ where: { email: parsed.data }, select: { id: true } });
    if (existing) return ok({ created: false });
    // Link to any browser already known by this email, so their visits show on the subscriber.
    const visitor = await prisma.visitor.findFirst({ where: { email: parsed.data }, orderBy: { lastSeenAt: "desc" }, select: { id: true } });
    await prisma.subscriber.create({ data: { email: parsed.data, source: "admin", visitorId: visitor?.id ?? null } });
    return ok({ created: true });
  } catch (error) {
    return toActionError(error);
  }
}

/** Removes a subscriber for good (for example when they ask to be taken off the list). */
export async function deleteSubscriber(id: string): Promise<ActionResult<DeleteOutcome>> {
  try {
    await requireAdmin("people:manage");
    const deleted = await prisma.subscriber.deleteMany({ where: { id } });
    if (!deleted.count) return fail("This subscriber was already removed.");
    return ok({ action: "deleted" });
  } catch (error) {
    return toActionError(error);
  }
}
