"use client";

import { flushSync } from "react-dom";
import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type Props = { className?: string; withLabel?: boolean };

/**
 * Switches light/dark. Where the View Transitions API exists, the new theme
 * grows out of the button as a circle; otherwise (or with reduced motion) it swaps instantly.
 * Icons swap with the `dark:` variant so nothing depends on hydrated theme state.
 */
export function ThemeToggle({ className, withLabel }: Props) {
  const { resolvedTheme, setTheme } = useTheme();

  const toggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    const apply = () => {
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(next);
      root.style.colorScheme = next;
      flushSync(() => setTheme(next));
    };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduce) {
      apply();
      return;
    }

    // Keyboard clicks report 0,0, so fall back to the button's centre.
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX || rect.left + rect.width / 2;
    const y = event.clientY || rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    const transition = document.startViewTransition(apply);
    transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 700, easing: "cubic-bezier(0.16, 1, 0.3, 1)", pseudoElement: "::view-transition-new(root)" }
      );
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle light and dark mode"
      className={cn(
        "inline-flex items-center gap-3 rounded-full text-foreground transition-colors hover:bg-surface-2",
        withLabel ? "h-12 w-full px-3 text-base" : "size-10 justify-center",
        className
      )}
    >
      <span className="relative grid size-5 place-items-center">
        <SunIcon className="absolute size-5 scale-0 rotate-90 transition-transform duration-500 dark:scale-100 dark:rotate-0" />
        <MoonIcon className="absolute size-5 scale-100 rotate-0 transition-transform duration-500 dark:scale-0 dark:-rotate-90" />
      </span>
      {withLabel && (
        <>
          <span className="dark:hidden">Dark mode</span>
          <span className="hidden dark:inline">Light mode</span>
        </>
      )}
    </button>
  );
}
