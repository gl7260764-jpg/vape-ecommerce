"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { MinusIcon, PlusIcon, ShoppingBagIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { formatPrice, type Product } from "@/lib/catalog";
import { useCart } from "@/lib/cart-store";
import { cn } from "@/lib/utils";

/** Price, quantity and add-to-cart. A compact bar takes over at the bottom of small screens once this scrolls away. */
export function BuyBox({ product, name }: { product: Product; name: string }) {
  const add = useCart((s) => s.add);
  const setOpen = useCart((s) => s.setOpen);
  const [qty, setQty] = useState(1);
  const [showBar, setShowBar] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const saving = product.compareAt - product.price;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setShowBar(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const addToCart = () => {
    add(product, qty);
    toast.success(`${qty} × ${product.flavour} added`, {
      action: { label: "View cart", onClick: () => setOpen(true) },
    });
  };

  return (
    <>
      <div ref={box} className="rounded-[var(--radius-tile)] border border-border bg-surface p-5 md:p-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="font-mono text-3xl font-medium tracking-tight">{formatPrice(product.price)}</p>
          {saving > 0 && (
            <>
              <p className="font-mono text-base text-muted-foreground line-through">{formatPrice(product.compareAt)}</p>
              <span className="rounded-full bg-primary px-2.5 py-1 font-mono text-xs font-semibold text-primary-foreground">
                Save {formatPrice(saving)}
              </span>
            </>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Price includes GST. Shipping calculated at checkout.</p>

        <div className="mt-6 flex gap-3">
          <div className="flex h-14 items-center rounded-full border border-border">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              aria-label="Decrease quantity"
              className="grid size-12 place-items-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-40"
              disabled={qty <= 1}
            >
              <MinusIcon className="size-4" />
            </button>
            <output aria-live="polite" className="w-8 text-center font-mono tabular-nums">
              {qty}
            </output>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(99, q + 1))}
              aria-label="Increase quantity"
              className="grid size-12 place-items-center rounded-full text-muted-foreground hover:text-foreground"
            >
              <PlusIcon className="size-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={addToCart}
            className="inline-flex h-14 flex-1 items-center justify-center gap-2.5 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
          >
            <ShoppingBagIcon weight="bold" className="size-5" />
            Add to cart
          </button>
        </div>
      </div>

      {/* Mobile sticky bar */}
      <div
        aria-hidden={!showBar}
        data-sticky-bar={showBar ? "shown" : "hidden"}
        className={cn(
          "glass fixed inset-x-0 bottom-0 z-[var(--z-header)] border-t border-border px-4 py-3 transition-transform duration-500 ease-[var(--ease-out-expo)] lg:hidden",
          showBar ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="flex items-center gap-3">
          {product.image && (
            <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-tile">
              <Image src={product.image} alt="" fill sizes="48px" className={product.imageFit === "cover" ? "scale-[1.12] object-cover" : "object-contain p-1"} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="font-mono text-sm">{formatPrice(product.price)}</p>
          </div>
          <button
            type="button"
            tabIndex={showBar ? 0 : -1}
            onClick={addToCart}
            className="h-11 shrink-0 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Add to cart
          </button>
        </div>
      </div>
    </>
  );
}
