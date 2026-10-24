import Link from "next/link";
import { FAMILY_LABELS, TYPE_LABELS } from "@/lib/filters";
import type { ProductDetail } from "@/lib/catalog-queries";

/** Key facts as tiles; only the specs this product actually has are shown. */
export function SpecTiles({ product }: { product: ProductDetail }) {
  const { specs } = product;
  const tiles = [
    specs.puffs && { label: "Puffs", value: specs.puffs.toLocaleString("en-AU") },
    specs.flavour && { label: "Flavour", value: specs.flavour },
    specs.family && { label: "Flavour group", value: FAMILY_LABELS[specs.family], href: `/shop?family=${specs.family}` },
    specs.volumeMl && { label: "Volume", value: `${specs.volumeMl}ml` },
    specs.nicotineMg && { label: product.type === "nicotine_pouch" ? "Strength" : "Nicotine", value: `${specs.nicotineMg}mg` },
    specs.packSize > 1 && { label: "Pack size", value: `${specs.packSize} pieces` },
    { label: "Type", value: TYPE_LABELS[product.type]?.replace(/s$/, "") ?? product.type, href: `/shop?type=${product.type}` },
    product.brand && { label: "Brand", value: product.brand.name, href: `/brand/${product.brand.slug}` },
  ].filter(Boolean) as { label: string; value: string; href?: string }[];

  return (
    <dl className="grid grid-cols-2 gap-3">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-2xl border border-border bg-surface/50 p-4">
          <dt className="text-xs text-muted-foreground">{t.label}</dt>
          <dd className="mt-1 truncate font-medium">
            {t.href ? (
              <Link href={t.href} className="hover:text-primary-ink hover:underline">
                {t.value}
              </Link>
            ) : (
              t.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
