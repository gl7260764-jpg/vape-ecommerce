"use client";

import Image, { getImageProps } from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowDownRightIcon, ArrowUpRightIcon } from "@phosphor-icons/react";
import { useDarkHero } from "@/components/site/dark-hero";
import { gsap, SplitText, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

// Stock loop: "Man vaping indoors with dark background" (Pexels 38917906, Pexels License, free for
// commercial use; the face is out of frame). Seconds 13-23, faded at both ends so it loops. Phones get
// a tall crop around the vape and the cloud. The still shows until the loop can play.
const PHONE = "(max-width: 767px)";
const HERO_VIDEO = { phone: "/hero/vape-cloud-phone.mp4", desktop: "/hero/vape-cloud.mp4" };
const still = { alt: "", sizes: "100vw", loading: "eager", fetchPriority: "high" } as const;
const desktopStill = getImageProps({ ...still, src: "/hero/vape-cloud.jpg", width: 1920, height: 1080 }).props.srcSet;
const { srcSet: phoneStill, ...stillProps } = getImageProps({ ...still, src: "/hero/vape-cloud-phone.jpg", width: 540, height: 960 }).props;

export function Hero() {
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const setDarkHero = useDarkHero((s) => s.set);

  // The hero is dark in both themes: the header over it uses its dark look until the page scrolls.
  useEffect(() => {
    setDarkHero(true);
    return () => setDarkHero(false);
  }, [setDarkHero]);

  // The video can be playable before hydration, so check readyState as well as listening.
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const mark = () => setVideoReady(true);
    if (el.readyState >= 3) mark();
    else el.addEventListener("canplay", mark, { once: true });
    return () => el.removeEventListener("canplay", mark);
  }, []);

  useGSAP(
    () => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const reveal = gsap.utils.toArray<HTMLElement>("[data-reveal]");
      if (reduce) {
        // Hold the loop on its first frame for people who ask for less motion.
        video.current?.pause();
        gsap.set(reveal, { autoAlpha: 1 });
        return;
      }

      const tl = gsap.timeline({ delay: 0.15 });
      tl.fromTo(".hero-media", { scale: 1.12, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 2.2 }, 0);

      SplitText.create(".hero-title", {
        type: "lines,words",
        mask: "lines",
        autoSplit: true,
        onSplit(self) {
          gsap.set(".hero-title", { autoAlpha: 1 });
          return tl.from(self.words, { yPercent: 110, duration: 1.3, stagger: 0.07 }, 0.25);
        },
      });

      tl.fromTo(
        ".hero-sub, .hero-ctas",
        { y: 24, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 1.1, stagger: 0.12 },
        0.75
      ).fromTo(".hero-card", { x: 40, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 1.2 }, 1.05);

      // Scroll-away: copy drifts up and fades while the video pushes in.
      gsap.to(".hero-content", {
        yPercent: -18,
        autoAlpha: 0.15,
        ease: "none",
        scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
      });
      gsap.to(".hero-media-inner", {
        scale: 1.18,
        ease: "none",
        scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
      });
    },
    { scope: root }
  );

  return (
    <section ref={root} className="dark relative isolate flex min-h-[100dvh] overflow-hidden bg-background text-foreground" aria-labelledby="hero-title">
      <div className="hero-media invisible absolute inset-0 -z-10" data-reveal>
        <div className="hero-media-inner absolute inset-0">
          <picture>
            <source media={PHONE} srcSet={phoneStill} />
            <source media="(min-width: 768px)" srcSet={desktopStill} />
            <img {...stillProps} alt="" className="absolute inset-0 size-full object-cover" />
          </picture>
          {/* Hidden for people who ask for less motion: they see the still. */}
          <video
            ref={video}
            className={cn(
              "absolute inset-0 size-full object-cover transition-opacity duration-[1500ms] motion-reduce:hidden",
              videoReady ? "opacity-100" : "opacity-0"
            )}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden
          >
            <source media={PHONE} src={HERO_VIDEO.phone} type="video/mp4" />
            <source src={HERO_VIDEO.desktop} type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-[radial-gradient(55%_65%_at_82%_78%,oklch(0.9_0.175_123/14%),transparent_70%)]" />
        </div>
        {/* Mobile: even scrim behind centred copy. Desktop: fade from the left-aligned copy into the video. */}
        <div className="absolute inset-0 bg-background/45 lg:bg-transparent lg:bg-[linear-gradient(90deg,var(--background)_0%,color-mix(in_oklch,var(--background)_55%,transparent)_42%,transparent_75%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="hero-content mx-auto flex w-full max-w-[1400px] flex-col justify-center px-4 pt-28 pb-14 text-center sm:px-6 md:pb-20 lg:justify-end lg:px-10 lg:pt-24 lg:text-left">
        <h1
          id="hero-title"
          className="hero-title invisible font-display text-[clamp(2.1rem,7.2vw,6.75rem)] leading-[0.95] font-extrabold tracking-[-0.035em] uppercase"
          data-reveal
        >
          {/* The space keeps the words apart in the page text ("clouds. Better"); the break does the layout. */}
          Big clouds.{" "}
          <br />
          <span className="text-primary-ink">Better prices.</span>
        </h1>
        <div className="mt-2 grid grid-cols-1 items-end gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <p
            className="hero-sub invisible mx-auto mt-7 max-w-[34ch] text-lg leading-relaxed text-foreground/75 md:text-xl lg:mx-0"
            data-reveal
          >
            Genuine IGET, Alibarbar and HQD disposables at bulk-buy prices, shipped Australia-wide.
          </p>
          <div className="hero-ctas invisible mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start" data-reveal>
            <Link
              href="/shop"
              className="group inline-flex h-14 items-center gap-3 rounded-full bg-primary pr-2 pl-7 text-base font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
            >
              Shop now
              <span className="grid size-10 place-items-center rounded-full bg-primary-foreground text-primary transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:rotate-45">
                <ArrowUpRightIcon weight="bold" className="size-4" />
              </span>
            </Link>
            <a
              href="#flavours"
              className="inline-flex h-14 items-center gap-2 rounded-full border border-foreground/20 px-7 text-base font-medium text-foreground backdrop-blur-sm transition-colors hover:border-foreground/50"
            >
              Explore flavours
              <ArrowDownRightIcon className="size-4" />
            </a>
          </div>
        </div>

        <Link
          href="/product-category/alibarbar-ingot"
          className="hero-card glass group invisible hidden items-center gap-4 rounded-[var(--radius-tile)] border border-border p-3 pr-5 lg:col-span-5 lg:ml-auto lg:flex lg:max-w-sm"
          data-reveal
        >
          <span className="relative size-24 shrink-0 overflow-hidden rounded-[0.9rem] bg-tile">
            <Image
              src="/products/cut/alibarbar-ingot.png"
              alt="Alibarbar Ingot custom pack"
              fill
              sizes="96px"
              className="object-contain p-1.5 transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-110"
            />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-medium text-primary-ink">New in</span>
            <span className="mt-1 block font-medium">Alibarbar Ingot custom pack</span>
            <span className="mt-1 block text-sm text-muted-foreground">Our best price per bar</span>
          </span>
          <ArrowUpRightIcon className="ml-auto size-5 shrink-0 text-muted-foreground transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
        </Link>
        </div>
      </div>

      <noscript>
        <style>{`[data-reveal]{visibility:visible!important}`}</style>
      </noscript>
    </section>
  );
}
