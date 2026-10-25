import "server-only";
import { requireAdmin } from "@/lib/admin/auth";
import { mediaUrl } from "@/lib/catalog";
import { prisma } from "@/lib/db";

// Admin › Push notifications: the device count, the products to push, and what was sent.

export async function pushOverview() {
  await requireAdmin("settings:write");
  const [devices, sent, history] = await Promise.all([
    prisma.pushSubscription.count(),
    prisma.pushBroadcast.count(),
    prisma.pushBroadcast.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, title: true, body: true, sentCount: true, createdAt: true, product: { select: { name: true } }, sentBy: { select: { name: true } } },
    }),
  ]);
  return { devices, sent, history, lastSentAt: history[0]?.createdAt ?? null };
}

/** Active products customers can buy, matching the search, with when each was last pushed. */
export async function pushProducts(q: string) {
  await requireAdmin("settings:write");
  const text = q.trim().slice(0, 100);
  const rows = await prisma.product.findMany({
    where: { status: "active", isPurchasable: true, ...(text && { name: { contains: text, mode: "insensitive" as const } }) },
    orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
    take: 40,
    select: {
      id: true,
      name: true,
      priceCents: true,
      stockStatus: true,
      images: { where: { key: { not: null } }, orderBy: { position: "asc" }, take: 1, select: { key: true } },
      pushBroadcasts: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    priceCents: p.priceCents,
    stockStatus: p.stockStatus,
    image: p.images[0]?.key ? mediaUrl(p.images[0].key) : null,
    lastPushedAt: p.pushBroadcasts[0]?.createdAt.toISOString() ?? null,
  }));
}

export type PushProduct = Awaited<ReturnType<typeof pushProducts>>[number];
