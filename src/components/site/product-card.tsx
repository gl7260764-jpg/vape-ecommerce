"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { CheckIcon, ImageIcon, PlusIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { formatPrice, productMeta, type Product } from "@/lib/catalog";
import { useCart } from "@/lib/cart-store";
import { gsap } from "@/lib/gsap";
import { cn } from "@/lib/utils";

type Props = Omit<React.ComponentProps<"article">, "children"> & {
  product: Product;
  sizes?: string;
  priority?: boolean;
};

export function ProductCard({
  product,
  className,
  sizes = "(min-width: 1024px) 22vw, 46vw",
  priority,
  ...props
}: Props) {
  const add = useCart((s) => s.add);
  const [added, setAdded] = useState(false);
  const imageRef = useRef<HTMLAnchorElement>(null);
  const href = `/product/${product.slug}`;
  const saving = product.compareAt - product.price;

  const onAdd = () => {
    add(product);
    setAdded(true);
    toast.success(`${product.flavour} added`, { description: productMeta(product) });
    if (imageRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.fromTo(imageRef.current, { scale: 0.94 }, { scale: 1, duration: 0.7, ease: "elastic.out(1, 0.5)" });
    }
    window.setTimeout(() => setAdded(false), 1400);
  };

  return (
    <article className={cn("group/card relative flex flex-col", className)} {...props}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-tile)] bg-tile">
        <Link
          href={href}
          tabIndex={-1}
          aria-hidden
          ref={imageRef}
          className="absolute inset-0 transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/card:scale-[1.06]"
        >
          {product.image ? (
            <Image
              src={product.image}
              alt={`${product.line} ${product.flavour}`}
              fill
              sizes={sizes}
              priority={priority}
              className={product.imageFit === "cover" ? "scale-[1.12] object-cover" : "object-contain p-[9%]"}
            />
          ) : (
            <span className="grid size-full place-items-center text-tile-foreground/25">
              <ImageIcon className="size-10" aria-hidden />
              <span className="sr-only">No photo yet</span>
            </span>
          )}
        </Link>
        {saving > 0 && (
          <span className="absolute top-3 left-3 rounded-full bg-tile-foreground px-2.5 py-1 font-mono text-[0.7rem] font-medium text-tile">
            Save {formatPrice(saving)}
          </span>
        )}
        <button
          type="button"
          onClick={onAdd}
          aria-label={`Add ${product.flavour} to cart`}
          className={cn(
            "absolute right-3 bottom-3 grid size-11 place-items-center rounded-full bg-tile-foreground text-tile shadow-[0_8px_24px_-8px_var(--shadow-soft)] transition-all duration-300 ease-[var(--ease-out-expo)] hover:bg-primary hover:text-primary-foreground focus-visible:ring-3 focus-visible:ring-ring active:scale-95",
            added && "bg-primary text-primary-foreground"
          )}
        >
          {added ? <CheckIcon weight="bold" className="size-5" /> : <PlusIcon weight="bold" className="size-5" />}
        </button>
      </div>
      <div className="mt-4 flex flex-col gap-2 px-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-[0.95rem] leading-snug font-medium text-foreground">
            <Link href={href} className="transition-colors hover:text-primary-ink focus-visible:underline">
              {product.flavour}
            </Link>
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {productMeta(product)}
          </p>
        </div>
        <div className="flex items-baseline gap-2 sm:block sm:shrink-0 sm:text-right">
          <p className="font-mono text-[0.95rem] font-medium text-foreground">{formatPrice(product.price)}</p>
          {saving > 0 && (
            <p className="font-mono text-xs text-muted-foreground line-through decoration-muted-foreground/60">
              {formatPrice(product.compareAt)}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
