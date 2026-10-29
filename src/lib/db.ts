import "server-only";
import { setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

// One client per process. node-postgres over Neon's pooled (PgBouncer) URL suits a
// long-lived Node server or Vercel Fluid compute; migrations use the direct URL instead.

// Node gives each of the database's addresses 250ms to answer before trying the next, and fails with
// ETIMEDOUT once all have had their turn. The database is ~175ms away from a build outside the US, and a
// build worker busy rendering pages can't notice the answer in time, so prerendering failed at random.
setDefaultAutoSelectFamilyAttemptTimeout(2_000);

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString: env.postgres.databaseUrl }) });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
