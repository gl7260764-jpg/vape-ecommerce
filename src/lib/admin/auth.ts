import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import type { AdminRole } from "@/generated/prisma/client";
import { SESSION_COOKIE, SESSION_DAYS } from "@/lib/admin/constants";
import { STAFF_COOKIE } from "@/lib/analytics/constants";

export type Permission = "catalog:write" | "catalog:delete" | "orders:write" | "settings:write" | "team:write" | "people:manage";

/** The role matrix from ADMIN-BLUEPRINT.md. Owner holds everything. */
const ROLE_PERMISSIONS: Record<AdminRole, readonly (Permission | "*")[]> = {
  owner: ["*"],
  staff: ["catalog:write", "orders:write"],
};

export const can = (role: AdminRole, permission: Permission) =>
  ROLE_PERMISSIONS[role].includes("*") || ROLE_PERMISSIONS[role].includes(permission);

export type Admin = { id: string; name: string; email: string; role: AdminRole };

export class AdminAuthError extends Error {
  constructor(readonly code: "UNAUTHENTICATED" | "FORBIDDEN") {
    super(code);
    this.name = "AdminAuthError";
  }
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** The signed-in admin for this request, or null. Deduplicated per request. */
export const getAdmin = cache(async (): Promise<Admin | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[\w-]{40,64}$/.test(token)) return null;
  const session = await prisma.adminSession.findUnique({
    where: { id: hashToken(token) },
    select: { expiresAt: true, user: { select: { id: true, name: true, email: true, role: true, isActive: true } } },
  });
  if (!session || session.expiresAt <= new Date() || !session.user.isActive) return null;
  const { id, name, email, role } = session.user;
  return { id, name, email, role };
});

/**
 * The data guard. First statement of every admin data loader and server action:
 * a page-level check alone doesn't protect an action, which is addressable on its own.
 */
export async function requireAdmin(permission?: Permission): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) throw new AdminAuthError("UNAUTHENTICATED");
  if (permission && !can(admin.role, permission)) throw new AdminAuthError("FORBIDDEN");
  return admin;
}

/** The page guard: signed-out visitors go to the login screen, under-privileged admins to the dashboard. */
export async function requireAdminPage(permission?: Permission): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  if (permission && !can(admin.role, permission)) redirect("/admin");
  return admin;
}

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const h = await headers();
  await prisma.adminSession.create({
    data: { id: hashToken(token), userId, expiresAt, ip: await clientIp(), userAgent: h.get("user-agent")?.slice(0, 300) ?? null },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    expires: expiresAt,
  });
  // Not a credential: only tells analytics that this browser's store visits are the team's own.
  (await cookies()).set(STAFF_COOKIE, "1", { path: "/", sameSite: "lax", maxAge: 400 * 86_400, secure: process.env.NODE_ENV === "production" });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.adminSession.deleteMany({ where: { id: hashToken(token) } });
  jar.delete({ name: SESSION_COOKIE, path: "/admin" });
}
