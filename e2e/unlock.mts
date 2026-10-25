// Clears sign-in limits that the e2e runs used up from this machine (::1 and @example.com emails).
// Run: node --conditions=react-server --import tsx e2e/unlock.mts
import "@/lib/test/env";
const { prisma } = await import("@/lib/db");
const r = await prisma.loginAttempt.deleteMany({
  where: {
    OR: [
      { key: { in: ["account:ip:::1", "login:ip:::1", "chat-start:ip:::1"] } },
      { AND: [{ OR: [{ key: { startsWith: "account:email:" } }, { key: { startsWith: "login:email:" } }, { key: { startsWith: "chat-start:email:" } }] }, { key: { endsWith: "@example.com" } }] },
    ],
  },
});
console.log("cleared", r.count);
await prisma.$disconnect();
