// Creates an admin account, or resets the password of an existing one. There is no sign-up page.
//
//   npx tsx scripts/admin/create-admin.mts --email owner@example.com --name "Store Owner" [--role owner|staff]
//   npx tsx scripts/admin/create-admin.mts --email owner@example.com --reset
//
// The password comes from ADMIN_PASSWORD if set (12+ characters); otherwise a strong one is
// generated and printed once. Nothing else prints secrets.
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import nextEnv from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type AdminRole } from "../../src/generated/prisma/client";
import { hashPassword } from "../../src/lib/admin/password";

nextEnv.loadEnvConfig(process.cwd());

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    role: { type: "string", default: "owner" },
    reset: { type: "boolean", default: false },
  },
});

const email = values.email?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Pass --email with a valid address.");
if (!["owner", "staff"].includes(values.role!)) throw new Error("--role must be owner or staff.");

const password = process.env.ADMIN_PASSWORD ?? randomBytes(12).toString("base64url");
if (password.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_UNPOOLED }) });
try {
  const passwordHash = await hashPassword(password);
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing && !values.reset) throw new Error(`${email} already has an account. Add --reset to set a new password.`);
  if (!existing && values.reset) throw new Error(`No account for ${email}.`);

  if (existing) {
    // A reset also signs the account out everywhere.
    await prisma.$transaction([
      prisma.adminUser.update({ where: { email }, data: { passwordHash, isActive: true } }),
      prisma.adminSession.deleteMany({ where: { userId: existing.id } }),
    ]);
    console.log(`Password reset for ${email}.`);
  } else {
    if (!values.name?.trim()) throw new Error("Pass --name for a new account.");
    await prisma.adminUser.create({ data: { email, name: values.name.trim(), role: values.role as AdminRole, passwordHash } });
    console.log(`Created ${values.role} account for ${email}.`);
  }
  if (!process.env.ADMIN_PASSWORD) console.log(`Password: ${password}\nStore it in a password manager; it won't be shown again.`);
} finally {
  await prisma.$disconnect();
}
