"use client";

import Image from "next/image";
import Link from "next/link";
import { MinusIcon, PlusIcon, ShoppingBagOpenIcon, TrashIcon } from "@phosphor-icons/react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cartCount, cartSubtotal, useCart } from "@/lib/cart-store";
import { formatPrice, productMeta } from "@/lib/catalog";
import { useLenisLock } from "@/hooks/use-lenis-lock";

export function CartSheet() {
  const { lines, open, setOpen, setQuantity, remove } = useCart();
  useLenisLock(open);
  const count = cartCount(lines);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="w-full gap-0 border-border bg-surface p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle className="font-display text-lg font-bold uppercase">Your cart</SheetTitle>
          <SheetDescription>
            {count === 0 ? "Nothing in here yet." : `${count} ${count === 1 ? "item" : "items"}`}
          </SheetDescription>
        </SheetHeader>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-surface-2">
              <ShoppingBagOpenIcon className="size-7 text-muted-foreground" />
            </span>
            <div>
              <p className="font-medium">Your cart is empty</p>
              <p className="mt-1 text-sm text-muted-foreground">Tap the + on any product to add it here.</p>
            </div>
            <Button
              variant="outline"
              className="h-11 rounded-full px-6"
              onClick={() => setOpen(false)}
            >
              Keep browsing
            </Button>
          </div>
        ) : (
          <>
            <ul data-lenis-prevent className="flex-1 divide-y divide-border overflow-y-auto px-6">
              {lines.map(({ product, quantity }) => (
                <li key={product.id} className="flex gap-4 py-5">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-tile">
                    {product.image && (
                      <Image src={product.image} alt="" fill sizes="80px" className={product.imageFit === "cover" ? "scale-[1.12] object-cover" : "object-contain p-2"} />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{product.flavour}</p>
                        <p className="text-xs text-muted-foreground">
                          {productMeta(product)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(product.id)}
                        aria-label={`Remove ${product.flavour}`}
                        className="-m-1.5 rounded-full p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <TrashIcon className="size-4" />
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <div className="flex items-center rounded-full border border-border">
                        <button
                          type="button"
                          onClick={() => setQuantity(product.id, quantity - 1)}
                          aria-label="Decrease quantity"
                          className="grid size-8 place-items-center rounded-full text-muted-foreground hover:text-foreground"
                        >
                          <MinusIcon className="size-3.5" />
                        </button>
                        <span className="w-6 text-center font-mono text-sm tabular-nums">{quantity}</span>
                        <button
                          type="button"
                          onClick={() => setQuantity(product.id, quantity + 1)}
                          aria-label="Increase quantity"
                          className="grid size-8 place-items-center rounded-full text-muted-foreground hover:text-foreground"
                        >
                          <PlusIcon className="size-3.5" />
                        </button>
                      </div>
                      <p className="font-mono text-sm">{formatPrice(product.price * quantity)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-border bg-background/40 px-6 py-5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="font-mono text-lg font-medium">{formatPrice(cartSubtotal(lines))}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Shipping calculated at checkout.</p>
              <Button
                asChild
                className="mt-5 h-12 w-full rounded-full text-base font-semibold active:scale-[0.98]"
              >
                <Link href="/checkout" onClick={() => setOpen(false)}>
                  Checkout
                </Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
