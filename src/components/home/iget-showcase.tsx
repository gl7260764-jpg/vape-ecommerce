"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { ProductCard } from "@/components/site/product-card";
import { formatPuffs, type Product } from "@/lib/catalog";
import { gsap, useGSAP } from "@/lib/gsap";

/**
 * Desktop: the section pins and vertical scroll pans the IGET range sideways.
 * Mobile and reduced motion: a native, swipeable scroll-snap row.
 */
export function IgetShowcase({ products }: { products: Product[] }) {
  const wrap = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        const distance = () => track.current!.scrollWidth - window.innerWidth;

        gsap.to(track.current, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: wrap.current,
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
          },
        });

        // Cards lift into place as they pan in from the right.
        gsap.utils.toArray<HTMLElement>(".iget-card").forEach((card, i) => {
          gsap.fromTo(
            card,
            { y: 60 + (i % 2) * 40, rotate: 2 },
            {
              y: 0,
              rotate: 0,
              ease: "none",
              scrollTrigger: {
                trigger: wrap.current,
                start: "top top",
                end: () => `+=${distance() * (0.12 + i * 0.09)}`,
                scrub: 1,
                invalidateOnRefresh: true,
              },
            }
          );
        });
      });

      mm.add("(min-width: 1024px) and (prefers-reduced-motion: reduce)", () => {
        viewport.current!.style.overflowX = "auto";
        return () => {
          viewport.current!.style.overflowX = "";
        };
      });

      return () => mm.revert();
    },
    { scope: wrap }
  );

  return (
    <section ref={wrap} aria-labelledby="iget-title" className="relative overflow-hidden bg-surface lg:min-h-[100dvh]">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 size-[36rem] rounded-full bg-primary/10 blur-[120px]"
      />
      {/* Intro stays put on desktop while the cards slide beneath its fade. */}
      <div className="relative z-10 px-4 pt-20 sm:px-6 lg:pointer-events-none lg:absolute lg:inset-y-0 lg:left-0 lg:flex lg:w-[38rem] lg:items-center lg:bg-[linear-gradient(90deg,var(--surface)_62%,transparent)] lg:px-10 lg:pt-0">
        <div className="lg:pointer-events-auto lg:w-[26rem]">
          {products.length > 0 && (
            <p className="font-mono text-sm text-primary-ink">
              {products[0].puffs ? `${formatPuffs(products[0].puffs)} · ` : ""}from ${Math.min(...products.map((p) => p.price))}
            </p>
          )}
          <h2
            id="iget-title"
            className="mt-4 font-display text-5xl leading-[0.9] font-extrabold tracking-[-0.03em] uppercase md:text-7xl"
          >
            IGET Bar
          </h2>
          <p className="mt-6 max-w-[34ch] text-lg leading-relaxed text-muted-foreground">
            Pocket-sized, all-day flavour. Australia&apos;s go-to disposable, now in eight flavours.
          </p>
          <Link
            href="/product-category/iget-bar-australia"
            className="group mt-9 inline-flex h-12 w-fit items-center gap-3 rounded-full border border-foreground/20 pr-2 pl-6 font-medium transition-colors hover:border-primary"
          >
            Shop IGET
            <span className="grid size-8 place-items-center rounded-full bg-foreground text-background transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <ArrowRightIcon weight="bold" className="size-3.5" />
            </span>
          </Link>
        </div>
      </div>

      <div
        ref={viewport}
        className="snap-x snap-mandatory scroll-px-4 overflow-x-auto [scrollbar-width:none] sm:scroll-px-6 lg:flex lg:h-[100dvh] lg:snap-none lg:items-center lg:overflow-x-visible [&::-webkit-scrollbar]:hidden"
      >
        <div ref={track} className="flex w-max items-start gap-4 px-4 pt-12 pb-20 sm:px-6 md:gap-5 lg:items-center lg:py-0 lg:pr-10 lg:pl-[38rem]">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              className="iget-card w-[68vw] shrink-0 snap-start sm:w-[19rem] lg:w-[20rem]"
              sizes="(min-width: 1024px) 320px, 68vw"
            />
          ))}
          <div aria-hidden className="w-1 shrink-0 lg:w-6" />
        </div>
      </div>
    </section>
  );
}
