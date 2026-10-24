"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/lib/catalog";
import { track } from "@/lib/analytics/client";

export type CartLine = { product: Product; quantity: number };

const cents = (dollars: number) => Math.round(dollars * 100);

type CartState = {
  lines: CartLine[];
  open: boolean;
  setOpen: (open: boolean) => void;
  add: (product: Product, quantity?: number) => void;
  setQuantity: (id: string, quantity: number) => void;
  remove: (id: string) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      open: false,
      setOpen: (open) => {
        if (open) track("open_cart");
        set({ open });
      },
      add: (product, quantity = 1) =>
        set((state) => {
          const n = Math.max(1, Math.floor(quantity));
          track("add_to_cart", { label: n > 1 ? `${n} × ${product.flavour}` : product.flavour, value: cents(product.price * n) });
          const existing = state.lines.find((l) => l.product.id === product.id);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.product.id === product.id ? { ...l, quantity: l.quantity + n } : l
              ),
            };
          }
          return { lines: [...state.lines, { product, quantity: n }] };
        }),
      setQuantity: (id, quantity) =>
        set((state) => {
          const line = state.lines.find((l) => l.product.id === id);
          if (line && quantity !== line.quantity) {
            const delta = quantity <= 0 ? line.quantity : Math.abs(quantity - line.quantity);
            track(quantity > line.quantity ? "add_to_cart" : "remove_from_cart", { label: line.product.flavour, value: cents(line.product.price * delta) });
          }
          return {
            lines:
              quantity <= 0
                ? state.lines.filter((l) => l.product.id !== id)
                : state.lines.map((l) => (l.product.id === id ? { ...l, quantity } : l)),
          };
        }),
      remove: (id) =>
        set((state) => {
          const line = state.lines.find((l) => l.product.id === id);
          if (line) track("remove_from_cart", { label: line.product.flavour, value: cents(line.product.price * line.quantity) });
          return { lines: state.lines.filter((l) => l.product.id !== id) };
        }),
      clear: () => set({ lines: [], open: false }),
    }),
    { name: "bvsa-cart", partialize: (state) => ({ lines: state.lines }) }
  )
);

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.quantity, 0);
export const cartSubtotal = (lines: CartLine[]) =>
  lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0);
