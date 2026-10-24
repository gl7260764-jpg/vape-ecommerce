import "server-only";
import { AdminAuthError, can, type Admin } from "@/lib/admin/auth";
import type { Actor } from "@/lib/chat/rules";

export type StaffActor = Extract<Actor, { kind: "staff" }>;

/** A team member acting in the chat. The owner (people:manage) can also remove anyone's message. */
export const staffActorFor = (admin: Admin): StaffActor => ({ kind: "staff", adminId: admin.id, canModerate: can(admin.role, "people:manage") });

/** The JSON answer for an admin route when requireAdmin() refused. */
export function adminAuthResponse(error: unknown): Response {
  if (error instanceof AdminAuthError) {
    return error.code === "FORBIDDEN"
      ? Response.json({ error: "Your account doesn't have permission to do that." }, { status: 403 })
      : Response.json({ error: "Sign in to continue." }, { status: 401 });
  }
  throw error;
}

/** Headers for chat data: never cached anywhere. */
export const NO_STORE = { "Cache-Control": "private, no-store" };
