"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { clientIp, endSession, startSession } from "@/lib/admin/auth";
import { DUMMY_HASH, verifyPassword } from "@/lib/admin/password";
import { adminLoginLimiter } from "@/lib/rate-limit";
import { fail, ok, toActionError, type ActionResult } from "@/lib/admin/result";

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(200),
});

/** Only admin paths, and never protocol-relative ("//evil.com"), so `next` can't become an open redirect. */
const safeNext = (next: unknown) =>
  typeof next === "string" && /^\/admin(\/|$|\?)/.test(next) && !next.startsWith("//") && !next.startsWith("/admin/login") ? next : "/admin";

const BAD_CREDENTIALS = "That email and password don't match. Check them and try again.";

export async function signIn(input: { email: string; password: string; next?: string }): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const parsed = signInSchema.safeParse(input);
    if (!parsed.success) return fail("Enter your email and password.");
    const { email, password } = parsed.data;

    const ip = await clientIp();
    if (await adminLoginLimiter.isLimited(ip, email)) {
      return fail("Too many sign-in attempts. Wait 15 minutes, then try again.");
    }

    const user = await prisma.adminUser.findUnique({ where: { email }, select: { id: true, passwordHash: true, isActive: true } });
    // Always run a hash check, so an unknown email takes as long as a wrong password.
    const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) {
      await adminLoginLimiter.record(ip, email);
      return fail(BAD_CREDENTIALS);
    }
    if (!user.isActive) return fail("This account is not authorized for admin access.");

    await startSession(user.id);
    await Promise.all([
      prisma.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
      adminLoginLimiter.clear(email),
    ]);
    return ok({ redirectTo: safeNext(input.next) });
  } catch (error) {
    return toActionError(error);
  }
}

/** Ends the session only. The client navigates afterwards, as a separate step. */
export async function signOut(): Promise<ActionResult> {
  try {
    await endSession();
    return ok(null);
  } catch (error) {
    return toActionError(error);
  }
}
