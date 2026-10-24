import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";

// Prisma 7 doesn't load env files itself. Reuse Next's loader so the
// .env.local written by `neon deploy` is picked up the same way the app sees it.
loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.mts",
  },
  // CLI work (migrate, seed, studio) uses the direct connection: PgBouncer's
  // transaction pooling breaks migrations. The app itself uses the pooled URL.
  // Left optional so `prisma generate` runs in CI without database credentials.
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED,
  },
});
