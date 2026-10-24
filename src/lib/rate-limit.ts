import "server-only";
import { prisma } from "@/lib/db";

const WINDOW_MS = 15 * 60 * 1000;

/**
 * Failed-attempt throttling on two keys: per IP, and per email (which stops one account being
 * guessed from many IPs). Each scope (admin sign-in, order lookup) counts separately.
 * Fails open: if the database can't answer, the attempt is allowed rather than locking people out.
 */
export function attemptLimiter(scope: string, limits: { ip: number; email: number }) {
  const keys = (ip: string, email: string) => ({ ip: `${scope}:ip:${ip}`, email: `${scope}:email:${email}` });

  return {
    async isLimited(ip: string, email: string) {
      try {
        const k = keys(ip, email);
        const since = new Date(Date.now() - WINDOW_MS);
        const [byIp, byEmail] = await Promise.all([
          prisma.loginAttempt.count({ where: { key: k.ip, createdAt: { gt: since } } }),
          prisma.loginAttempt.count({ where: { key: k.email, createdAt: { gt: since } } }),
        ]);
        return byIp >= limits.ip || byEmail >= limits.email;
      } catch (error) {
        console.error(`${scope} rate limit check failed, allowing`, error);
        return false;
      }
    },

    /** Counts one attempt: a failed sign-in, or any order lookup. */
    async record(ip: string, email: string) {
      try {
        const k = keys(ip, email);
        await prisma.loginAttempt.createMany({ data: [{ key: k.ip }, { key: k.email }] });
        // Keep the table small: drop anything older than a day.
        await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 86_400_000) } } });
      } catch (error) {
        console.error(`could not record a failed ${scope} attempt`, error);
      }
    },

    async clear(email: string) {
      await prisma.loginAttempt.deleteMany({ where: { key: keys("", email).email } }).catch(() => {});
    },
  };
}

/** Admin sign-in: 8 per IP and 5 per email every 15 minutes. */
export const adminLoginLimiter = attemptLimiter("login", { ip: 8, email: 5 });


/** Opening an account by email (the account icon, and subscribing): 15 per IP and 10 per email every 15 minutes, since it shows order summaries. */
export const accountLimiter = attemptLimiter("account", { ip: 15, email: 10 });

/** Chat uploads: 40 files per conversation (keyed as the "email") or per IP every 15 minutes. */
export const chatUploadLimiter = attemptLimiter("chat-upload", { ip: 40, email: 40 });
