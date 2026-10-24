"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics/client";
import { MagnifyingGlassIcon, PlusIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatPrice, productMeta, type Product } from "@/lib/catalog";
import { useCart } from "@/lib/cart-store";
import { useLenisLock } from "@/hooks/use-lenis-lock";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; products: Product[] };

/** Shows popular products until the visitor types, then searches the whole catalog via /api/search. */
export function SearchDialog({ open, onOpenChange, products }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[] | null>(null);
  const [loading, setLoading] = useState(false);
  const add = useCart((s) => s.add);
  const lastSearch = useRef("");
  useLenisLock(open);

  // One analytics event per search: the words in the box when they open a result or close search.
  const recordSearch = () => {
    const q = query.trim();
    if (q.length >= 2 && q !== lastSearch.current) {
      lastSearch.current = q;
      track("search", { label: q });
    }
  };

  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const data = (await res.json()) as { products: Product[] };
        setResults(data.products);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const typing = query.trim().length > 0;
  const list = typing ? (results ?? []) : products.slice(0, 6);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          recordSearch();
          setQuery("");
          setResults(null);
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="top-[12vh] max-w-[calc(100%-2rem)] translate-y-0 gap-0 overflow-hidden rounded-[var(--radius-tile)] border-border bg-surface p-0 sm:max-w-xl"
      >
        <DialogTitle className="sr-only">Search products</DialogTitle>
        <label className="flex items-center gap-3 border-b border-border px-5">
          <MagnifyingGlassIcon className="size-5 shrink-0 text-muted-foreground" />
          <span className="sr-only">Search flavours and brands</span>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try “grape”, “IGET” or “Geek Bar”"
            className="h-16 w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded-md border border-border px-1.5 py-0.5 font-mono text-[0.7rem] text-muted-foreground sm:block">
            Esc
          </kbd>
        </label>
        <div data-lenis-prevent className="max-h-[56vh] overflow-y-auto p-2" aria-busy={loading}>
          {typing && results === null ? (
            <ul aria-label="Loading results">
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="flex items-center gap-4 px-3 py-2.5">
                  <span className="size-12 shrink-0 animate-pulse rounded-lg bg-surface-2" />
                  <span className="h-4 flex-1 animate-pulse rounded bg-surface-2" />
                </li>
              ))}
            </ul>
          ) : list.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="font-medium">No match for “{query}”</p>
              <p className="mt-1 text-sm text-muted-foreground">Check the spelling or search by brand instead.</p>
            </div>
          ) : (
            <>
              {!typing && <p className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">Popular right now</p>}
              <ul className={loading ? "opacity-60 transition-opacity" : undefined}>
                {list.map((p) => (
                  <li key={p.id}>
                    <div className="flex items-center gap-4 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-2">
                      <Link
                        href={`/product/${p.slug}`}
                        onClick={() => {
                          recordSearch();
                          onOpenChange(false);
                        }}
                        className="flex min-w-0 flex-1 items-center gap-4 rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-tile">
                          {p.image && <Image src={p.image} alt="" fill sizes="48px" className={p.imageFit === "cover" ? "scale-[1.12] object-cover" : "object-contain p-1"} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{p.flavour}</p>
                          <p className="truncate text-xs text-muted-foreground">{productMeta(p)}</p>
                        </div>
                        <span className="font-mono text-sm">{formatPrice(p.price)}</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          add(p);
                          toast.success(`${p.flavour} added`);
                        }}
                        aria-label={`Add ${p.flavour} to cart`}
                        className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
                      >
                        <PlusIcon weight="bold" className="size-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
