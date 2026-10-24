"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { ProductCard } from "@/components/site/product-card";
import type { FlavourFamily, Product } from "@/lib/catalog";
import { Flip, gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

const filters: { value: "all" | FlavourFamily; label: string }[] = [
  { value: "all", label: "All flavours" },
  { value: "iced", label: "Iced" },
  { value: "fruit", label: "Fruit" },
];

export function HqdGrid({ products }: { products: Product[] }) {
  const root = useRef<HTMLElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<(typeof filters)[number]["value"]>("all");
  const flipState = useRef<Flip.FlipState | null>(null);

  // Entrance: cards rise in a cascade the first time the grid scrolls into view.
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const cards = gsap.utils.toArray<HTMLElement>(".hqd-card");
      gsap.set(cards, { autoAlpha: 0, y: 48 });
      ScrollTrigger.batch(cards, {
        start: "top 90%",
        once: true,
        onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.08 }),
      });
    },
    { scope: root }
  );

  // Filtering: Flip animates cards from their old slots to the new ones.
  useGSAP(
    () => {
      const state = flipState.current;
      if (!state) return;
      flipState.current = null;
      Flip.from(state, {
        duration: 0.7,
        ease: "power3.inOut",
        absolute: true,
        scale: true,
        onEnter: (els) => gsap.fromTo(els, { autoAlpha: 0, scale: 0.9 }, { autoAlpha: 1, scale: 1, duration: 0.6 }),
        onLeave: (els) => gsap.to(els, { autoAlpha: 0, scale: 0.9, duration: 0.4 }),
        onComplete: () => ScrollTrigger.refresh(),
      });
    },
    { dependencies: [filter], scope: root }
  );

  const choose = (value: typeof filter) => {
    if (value === filter) return;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && grid.current) {
      flipState.current = Flip.getState(grid.current.querySelectorAll(".hqd-card"));
    }
    setFilter(value);
  };

  return (
    <section
      ref={root}
      id="flavours"
      aria-labelledby="hqd-title"
      className="mx-auto max-w-[1400px] scroll-mt-24 px-4 py-24 sm:px-6 md:py-32 lg:px-10"
    >
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-sm text-primary-ink">20,000 puffs · rechargeable</p>
          <h2 id="hqd-title" className="mt-4 font-display text-4xl leading-[0.95] font-extrabold tracking-[-0.03em] uppercase md:text-6xl">
            HQD Cuvie Slick
          </h2>
        </div>
        <div role="group" aria-label="Filter by flavour" className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => choose(f.value)}
              className={cn(
                "h-10 rounded-full border px-5 text-sm font-medium transition-colors duration-300",
                filter === f.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-foreground/80 hover:border-foreground/40 hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={grid} className="mt-12 grid grid-cols-2 gap-x-4 gap-y-10 md:mt-14 lg:grid-cols-4 lg:gap-x-5 lg:gap-y-12">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            data-flip-id={product.id}
            className={cn("hqd-card", filter !== "all" && product.family !== filter && "hidden")}
          />
        ))}
      </div>

      <div className="mt-14 flex justify-center">
        <Link
          href="/product-category/hqd-cuvie-slick-20000"
          className="group inline-flex h-12 items-center gap-3 rounded-full border border-foreground/20 pr-2 pl-6 font-medium transition-colors hover:border-primary"
        >
          Shop HQD
          <span className="grid size-8 place-items-center rounded-full bg-foreground text-background transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <ArrowRightIcon weight="bold" className="size-3.5" />
          </span>
        </Link>
      </div>
    </section>
  );
}
