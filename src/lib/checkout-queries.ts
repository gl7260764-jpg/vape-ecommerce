import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/db";
import { mediaUrl } from "@/lib/catalog";
import type { CartLineInput } from "@/lib/checkout";

export type ShippingOption = { code: string; name: string; description: string | null; price: number };

/** Active delivery options. Tagged "shipping" so the admin dashboard can revalidateTag("shipping") after edits. */
export async function getShippingMethods(): Promise<ShippingOption[]> {
  "use cache";
  cacheTag("shipping");
  cacheLife("minutes");
  const rows = await prisma.shippingMethod.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  return rows.map((m) => ({ code: m.code, name: m.name, description: m.description, price: m.priceCents / 100 }));
}

export type PricedLine = {
  id: string;
  productId: string;
  slug: string;
  name: string;
  image: string;
  imageKey: string | null;
  imageFit: "cover" | "contain";
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
};

/**
 * Prices cart lines from the database, never from the browser. Lines for products that are gone,
 * unpublished or unpriced come back in `unavailable` so the customer can be told.
 */
export async function priceLines(lines: CartLineInput[]) {
  const clean = lines
    .filter((l) => /^\d{1,9}$/.test(l.id) && Number.isInteger(l.quantity))
    .map((l) => ({ wooId: Number(l.id), quantity: Math.min(Math.max(l.quantity, 1), 99) }))
    .slice(0, 50);
  const rows = await prisma.product.findMany({
    where: { wooId: { in: clean.map((l) => l.wooId) }, status: "active", isPurchasable: true, priceCents: { gt: 0 } },
    select: {
      id: true,
      wooId: true,
      slug: true,
      name: true,
      priceCents: true,
      images: { where: { key: { not: null } }, orderBy: { position: "asc" }, take: 1, select: { key: true, hasBackground: true } },
    },
  });
  const byWooId = new Map(rows.map((r) => [r.wooId, r]));

  const items: PricedLine[] = [];
  const unavailable: string[] = [];
  for (const line of clean) {
    const p = byWooId.get(line.wooId);
    if (!p) {
      unavailable.push(String(line.wooId));
      continue;
    }
    const img = p.images[0];
    items.push({
      id: String(p.wooId),
      productId: p.id,
      slug: p.slug,
      name: p.name,
      image: img?.key ? mediaUrl(img.key) : "",
      imageKey: img?.key ?? null,
      imageFit: img?.hasBackground ? "cover" : "contain",
      unitPriceCents: p.priceCents,
      quantity: line.quantity,
      lineTotalCents: p.priceCents * line.quantity,
    });
  }
  return { items, unavailable, subtotalCents: items.reduce((n, i) => n + i.lineTotalCents, 0) };
}
