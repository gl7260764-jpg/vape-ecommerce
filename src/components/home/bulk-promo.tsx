"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { ArrowUpRightIcon } from "@phosphor-icons/react";
import { gsap, SplitText, useGSAP } from "@/lib/gsap";

const fan = [
  { src: "/products/cut/1100.png", alt: "HQD Cuvie Slick Blueberry Raspberry", rotate: -14, x: -46 },
  { src: "/products/cut/alibarbar-ingot.png", alt: "Alibarbar Ingot 20-pack", rotate: 0, x: 0 },
  { src: "/products/cut/876.png", alt: "IGET Bar Blueberry Ice", rotate: 12, x: 46 },
];

/** Statement block: copy brightens word by word on scroll while the product fan opens. */
export function BulkPromo() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      SplitText.create(".promo-copy", {
        type: "words",
        autoSplit: true,
        onSplit(self) {
          return gsap.fromTo(
            self.words,
            { opacity: 0.16 },
            {
              opacity: 1,
              ease: "none",
              stagger: 0.1,
              scrollTrigger: { trigger: ".promo-copy", start: "top 80%", end: "bottom 45%", scrub: true },
            }
          );
        },
      });

      // Cards start stacked and fan out. The inline transform is the no-JS / reduced-motion layout.
      gsap.utils.toArray<HTMLElement>(".fan-card").forEach((card, i) => {
        gsap.set(card, { clearProps: "transform" });
        gsap.fromTo(
          card,
          { xPercent: 0, rotate: 0, y: 80 },
          {
            xPercent: fan[i].x,
            rotate: fan[i].rotate,
            y: 0,
            ease: "none",
            scrollTrigger: { trigger: ".fan", start: "top 95%", end: "center 55%", scrub: 1 },
          }
        );
      });
    },
    { scope: root }
  );

  return (
    <section ref={root} aria-labelledby="bulk-title" className="mx-auto max-w-[1400px] px-4 py-24 sm:px-6 md:py-36 lg:px-10">
      <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-7">
          <h2 id="bulk-title" className="font-display text-5xl leading-[0.9] font-extrabold tracking-[-0.03em] uppercase md:text-7xl">
            Stock up by the box
          </h2>
          <p className="promo-copy mt-8 max-w-[30ch] text-2xl leading-snug font-medium text-foreground md:text-[2.1rem] md:leading-[1.2]">
            Buying in bulk brings the price of every bar down. Pick your go-to flavour, stock up once and skip the weekly reorder.
          </p>
          <Link
            href="/product-category/iget-vapes-bulk-buy"
            className="group mt-10 inline-flex h-14 items-center gap-3 rounded-full bg-primary pr-2 pl-7 text-base font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
          >
            Shop bulk buys
            <span className="grid size-10 place-items-center rounded-full bg-primary-foreground text-primary transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:rotate-45">
              <ArrowUpRightIcon weight="bold" className="size-4" />
            </span>
          </Link>
        </div>

        <div className="fan relative mx-auto flex h-[22rem] w-full max-w-md items-center justify-center md:h-[28rem] lg:col-span-5">
          <div aria-hidden className="absolute inset-[12%] rounded-full bg-primary/15 blur-[90px]" />
          {fan.map((card, i) => (
            <div
              key={card.src}
              className="fan-card absolute aspect-[4/5] w-[46%] overflow-hidden rounded-[var(--radius-tile)] bg-tile shadow-[0_40px_80px_-30px_var(--shadow-strong)]"
              style={{
                transform: `translateX(${card.x}%) rotate(${card.rotate}deg)`,
                zIndex: i === 1 ? 2 : 1,
              }}
            >
              <Image src={card.src} alt={card.alt} fill sizes="(min-width: 1024px) 210px, 46vw" className="object-contain p-4" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
