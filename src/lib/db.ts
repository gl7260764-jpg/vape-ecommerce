import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

// One client per process. node-postgres over Neon's pooled (PgBouncer) URL suits a
// long-lived Node server or Vercel Fluid compute; migrations use the direct URL instead.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString: env.postgres.databaseUrl }) });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
