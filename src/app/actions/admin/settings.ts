"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/auth";
import { fail, ok, toActionError, type ActionResult } from "@/lib/admin/result";
import { refreshNewsletter, refreshShipping } from "@/lib/admin/revalidate";
import { shippingSettingsSchema, type ShippingMethodInput } from "@/lib/admin/schemas/shipping";
import { businessSchema, type BusinessInput } from "@/lib/admin/schemas/business";
import { newsletterSettingsSchema, type NewsletterSettingsInput } from "@/lib/admin/schemas/newsletter";
import { saveNewsletterSettings as storeNewsletterSettings } from "@/lib/newsletter";
import { saveStoreProfile } from "@/lib/store-profile";

/**
 * Saves every shipping option at once. Checkout reads these prices from the database
 * when an order is placed, so a change applies to the very next order.
 */
export async function saveShippingMethods(input: ShippingMethodInput[]): Promise<ActionResult> {
  try {
    await requireAdmin("settings:write");
    const parsed = shippingSettingsSchema.safeParse(input);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const [index, field] = issue.path;
        errors[typeof index === "number" && field ? `${index}.${String(field)}` : "form"] ??= issue.message;
      }
      return fail(errors.form ?? "Some fields need attention.", errors);
    }

    const ids = parsed.data.map((m) => m.id);
    const existing = await prisma.shippingMethod.count({ where: { id: { in: ids } } });
    if (existing !== new Set(ids).size) return fail("These shipping options changed in another tab. Refresh the page and try again.");

    await prisma.$transaction(
      parsed.data.map((m) =>
        prisma.shippingMethod.update({
          where: { id: m.id },
          data: { name: m.name, description: m.description, priceCents: m.priceCents, isActive: m.isActive },
        })
      )
    );
    refreshShipping();
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

/** The store's email, phone, address and ABN for invoices sent from now on. Invoices already sent keep theirs. */
export async function saveBusinessDetails(input: BusinessInput): Promise<ActionResult> {
  try {
    await requireAdmin("settings:write");
    const parsed = businessSchema.safeParse(input);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
      return fail("Some fields need attention.", errors);
    }
    await saveStoreProfile(parsed.data);
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}

/** How often the store's newsletter pop-up appears. Store pages pick up the change on their next load. */
export async function saveNewsletterSettings(input: NewsletterSettingsInput): Promise<ActionResult> {
  try {
    await requireAdmin("settings:write");
    const parsed = newsletterSettingsSchema.safeParse(input);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
      return fail("Some fields need attention.", errors);
    }
    await storeNewsletterSettings(parsed.data);
    refreshNewsletter();
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}
