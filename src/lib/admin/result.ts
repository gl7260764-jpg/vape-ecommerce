import "server-only";
import { unstable_rethrow } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { AdminAuthError } from "@/lib/admin/auth";

/** What every admin server action returns. `error` is written for the person using the admin. */
export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export const ok = <T,>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (error: string, fieldErrors?: Record<string, string>) => ({ ok: false as const, error, fieldErrors });

/** Field names as the admin sees them, for unique-constraint messages. */
const FIELD_LABELS: Record<string, string> = { slug: "web address (slug)", sku: "SKU", email: "email", code: "code", wooId: "store ID" };

function uniqueFields(error: Prisma.PrismaClientKnownRequestError): string[] {
  const meta = error.meta as Record<string, unknown> | undefined;
  const target = meta?.target;
  if (Array.isArray(target)) return target.map(String);
  if (typeof target === "string") return [target.replace(/^.*_(\w+)_key$/, "$1")];
  // Driver adapters (adapter-pg) report the constraint under driverAdapterError, either as
  // a field list or as the index name, e.g. "Product_slug_key".
  const constraint = (meta?.driverAdapterError as { cause?: { constraint?: { fields?: string[]; index?: string } } } | undefined)?.cause?.constraint;
  if (Array.isArray(constraint?.fields)) return constraint.fields.map((f) => f.replace(/"/g, ""));
  const fromIndex = constraint?.index?.match(/^[A-Za-z]+_(\w+?)_key$/)?.[1];
  return fromIndex ? [fromIndex] : [];
}

const WAKING = /P1001|P1002|P1008|P1017|P2024|ECONNRESET|ETIMEDOUT|ECONNREFUSED|terminating connection|Connection terminated|timeout/i;

/**
 * Turns anything thrown inside an admin action into a calm, specific message.
 * Framework control flow (redirect, notFound) is rethrown untouched.
 */
export function toActionError(error: unknown): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  unstable_rethrow(error);
  if (error instanceof AdminAuthError) {
    return fail(
      error.code === "FORBIDDEN" ? "Your account doesn't have permission to do that. Ask the store owner." : "Your session has ended. Sign in again to continue."
    );
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const fields = uniqueFields(error);
      const field = fields[0];
      const label = FIELD_LABELS[field] ?? field ?? "value";
      return fail(`Another record already uses this ${label}. Change it and save again.`, field ? { [field]: `Already in use` } : undefined);
    }
    if (error.code === "P2025") return fail("That record no longer exists. Refresh the page to see the latest.");
    if (error.code === "P2003") return fail("This is still linked to other records, so it can't be changed that way.");
  }
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (WAKING.test(message) || (error instanceof Prisma.PrismaClientKnownRequestError && WAKING.test(error.code))) {
    return fail("The database was waking up. Please click Save again.");
  }
  console.error("admin action failed", error);
  return fail("Something went wrong and nothing was saved. Try again, and if it keeps happening, let the developer know.");
}
