"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ListIcon, MagnifyingGlassIcon, ShoppingBagIcon, UserCircleIcon } from "@phosphor-icons/react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { InstallButton } from "@/components/app/install-button";
import { useInstallIconShown } from "@/components/app/install-store";
import { MessagesButton } from "@/components/chat/customer/messages-button";
import { Logo } from "@/components/site/logo";
import { navLinks } from "@/components/site/nav-links";
import { SearchDialog } from "@/components/site/search-dialog";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { cartCount, useCart } from "@/lib/cart-store";
import type { Product } from "@/lib/catalog";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { useHydrated } from "@/hooks/use-hydrated";
import { useLenisLock } from "@/hooks/use-lenis-lock";
import { cn } from "@/lib/utils";

export function Header({ products }: { products: Product[] }) {
  const ref = useRef<HTMLElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const hydrated = useHydrated();
  const installIcon = useInstallIconShown();
  const count = useCart((s) => cartCount(s.lines));
  const setCartOpen = useCart((s) => s.setOpen);
  useLenisLock(menuOpen);

  // Glass state after the first 40px, hide on scroll down, reveal on scroll up.
  useGSAP(() => {
    const header = ref.current;
    if (!header) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ScrollTrigger.create({
      start: 40,
      end: "max",
      onToggle: (self) => setScrolled(self.isActive),
      onUpdate: (self) => {
        if (reduce) return;
        const hide = self.direction === 1 && self.scroll() > 520;
        gsap.to(header, { yPercent: hide ? -100 : 0, duration: 0.5, ease: "power3.out", overwrite: true });
      },
    });
  });

  // Bump the badge when the count goes up.
  const previous = useRef(count);
  useEffect(() => {
    if (count > previous.current && badgeRef.current) {
      gsap.fromTo(badgeRef.current, { scale: 1.6 }, { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.45)" });
      if (ref.current) gsap.to(ref.current, { yPercent: 0, duration: 0.4, overwrite: true });
    }
    previous.current = count;
  }, [count]);

  // "/" opens search, like most stores and docs sites.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === "/" && !/input|textarea/i.test(target.tagName)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header
        ref={ref}
        className={cn(
          "fixed inset-x-0 top-0 z-[var(--z-header)] transition-[background-color,box-shadow,border-color] duration-500",
          scrolled ? "glass border-b border-border" : "border-b border-transparent"
        )}
      >
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:gap-6 sm:px-6 lg:h-[4.5rem] lg:px-10">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="-ml-2 grid size-10 place-items-center rounded-full text-foreground hover:bg-surface-2 lg:hidden"
          >
            <ListIcon className="size-5" />
          </button>

          <Link href="/" aria-label="Best Vape Shop Australia home" className="shrink-0">
            {/* With the install icon in the bar, small phones show just the "B" mark to keep the cart on screen. */}
            <Logo subtitleClassName="max-[399px]:hidden" wordmarkClassName={installIcon ? "max-[419px]:hidden" : undefined} />
          </Link>

          <nav aria-label="Primary" className="ml-2 hidden lg:block xl:ml-4">
            <ul className="flex items-center gap-1">
              {navLinks.map((link) => (
                <li key={link.href} className={"wide" in link && link.wide ? "hidden xl:block" : undefined}>
                  <Link
                    href={link.href}
                    className="rounded-full px-3 py-2 text-sm whitespace-nowrap text-foreground/80 transition-colors hover:bg-surface-2 hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden h-10 items-center gap-2.5 rounded-full border border-border bg-surface/60 pr-2 pl-4 text-sm text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground 2xl:flex"
            >
              <MagnifyingGlassIcon className="size-4" />
              <span className="pr-8">Search flavours</span>
              <kbd className="rounded-full border border-border px-2 py-0.5 font-mono text-[0.7rem]">/</kbd>
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="grid size-9 place-items-center rounded-full hover:bg-surface-2 sm:size-10 2xl:hidden"
            >
              <MagnifyingGlassIcon className="size-5" />
            </button>
            <ThemeToggle className="hidden md:inline-flex" />
            <InstallButton />
            <MessagesButton />
            <Link href="/account" aria-label="Your account" title="Your account" className="grid size-9 place-items-center rounded-full hover:bg-surface-2 sm:size-10">
              <UserCircleIcon className="size-[22px]" />
            </Link>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              aria-label={`Open cart, ${hydrated ? count : 0} items`}
              className="relative flex size-10 items-center justify-center gap-2 rounded-full bg-foreground text-sm font-medium text-background transition-transform active:scale-[0.97] sm:w-auto sm:justify-start sm:pr-4 sm:pl-3.5"
            >
              <ShoppingBagIcon weight="bold" className="size-4" />
              <span className="hidden sm:inline">Cart</span>
              {/* On phones the count sits on the bag's corner, so the bar fits beside the account and message icons. */}
              <span
                ref={badgeRef}
                className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-primary px-1.5 font-mono text-[0.7rem] leading-5 text-primary-foreground ring-2 ring-background sm:static sm:ring-0"
              >
                {hydrated ? count : 0}
              </span>
            </button>
          </div>
        </div>
      </header>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} products={products} />

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[86%] max-w-sm gap-0 border-border bg-surface p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="border-b border-border px-6 py-5">
            <Logo />
          </div>
          <nav aria-label="Mobile" className="px-3 py-4">
            <ul>
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-xl px-3 py-3.5 font-display text-lg font-semibold uppercase transition-colors hover:bg-surface-2"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/account"
                  onClick={() => setMenuOpen(false)}
                  className="mt-2 flex items-center gap-3 rounded-xl border-t border-border px-3 pt-5 pb-3.5 font-display text-lg font-semibold uppercase transition-colors hover:bg-surface-2"
                >
                  <UserCircleIcon className="size-5" aria-hidden /> Your account
                </Link>
              </li>
            </ul>
          </nav>
          <div className="mt-auto border-t border-border px-3 py-3">
            <ThemeToggle withLabel />
          </div>
          <p className="border-t border-border px-6 py-5 text-xs leading-relaxed text-muted-foreground">
            Adults 18+ only. Nicotine is highly addictive.
          </p>
        </SheetContent>
      </Sheet>
    </>
  );
}
