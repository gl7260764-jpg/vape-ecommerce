"use client";

import { useRef } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

type Props = React.ComponentProps<"div"> & {
  /** Stagger between `[data-stagger]` children entering together. */
  stagger?: number;
  y?: number;
};

/**
 * Lets server-rendered sections opt into scroll reveals: every `[data-stagger]`
 * descendant fades up as it enters the viewport, batched so rows cascade.
 */
export function Reveal({ className, stagger = 0.08, y = 36, children, ...props }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const items = gsap.utils.toArray<HTMLElement>("[data-stagger]");
      if (!items.length) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      gsap.set(items, { autoAlpha: 0, y });
      ScrollTrigger.batch(items, {
        start: "top 88%",
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, { autoAlpha: 1, y: 0, duration: 1.1, stagger, overwrite: true }),
      });
    },
    { scope: ref }
  );

  return (
    <div ref={ref} className={cn(className)} {...props}>
      {children}
    </div>
  );
}
