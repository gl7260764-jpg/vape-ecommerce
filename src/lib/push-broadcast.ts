import "server-only";
import { mediaUrl } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { pushToAll } from "@/lib/push";

/**
 * Admin › Push notifications: sends a product to every device with notifications on (with its photo,
 * opening the product page) and records it in the history.
 */
export async function broadcastProduct(input: { productId: string; title: string; body: string; sentById: string | null }): Promise<{ sent: number }> {
  // Only products customers can buy right now.
  const product = await prisma.product.findFirstOrThrow({
    where: { id: input.productId, status: "active", isPurchasable: true },
    select: { id: true, slug: true, images: { where: { key: { not: null } }, orderBy: { position: "asc" }, take: 1, select: { key: true } } },
  });
  const key = product.images[0]?.key;
  const url = `/product/${product.slug}`;
  const image = key ? mediaUrl(key) : undefined;
  // Recorded first, so a send that's cut short still shows in the history (and on the product).
  const row = await prisma.pushBroadcast.create({ data: { productId: product.id, title: input.title, body: input.body, url, image: image ?? null, sentById: input.sentById, sentCount: 0 } });
  const sent = await pushToAll({ title: input.title, body: input.body, url, ...(image ? { image } : {}), tag: `product-${product.id}` });
  // The pushes are out: a hiccup saving the count mustn't tell the owner to send it again.
  await prisma.pushBroadcast.update({ where: { id: row.id }, data: { sentCount: sent } }).catch((error) => console.error("push count not saved", error));
  return { sent };
}
