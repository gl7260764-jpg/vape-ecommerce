// A pretend notification subscription for the push e2e (headless Chrome can't subscribe):
//   node --conditions=react-server --import tsx e2e/push-fixture.mts add|remove
import "@/lib/test/env";
const { prisma } = await import("@/lib/db");
const ENDPOINT = "https://push.example.com/e2e-fixture";
if (process.argv[2] === "add") {
  await prisma.pushSubscription.upsert({
    where: { endpoint: ENDPOINT },
    create: { endpoint: ENDPOINT, p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg", deviceTokenHash: "e2e-fixture" },
    update: {},
  });
  console.log("added");
} else {
  await prisma.pushSubscription.deleteMany({ where: { endpoint: ENDPOINT } });
  console.log("removed");
}
await prisma.$disconnect();
