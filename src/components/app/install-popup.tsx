"use client";

import { CheckIcon, XIcon } from "@phosphor-icons/react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useRef } from "react";
import { useLenisLock } from "@/hooks/use-lenis-lock";
import { cn } from "@/lib/utils";

const ART = "bg-[radial-gradient(circle_at_30%_30%,#e6ff7a,#a8cc1c_55%,#5e7a07)] text-[#121408]";
const PILL = "inline-flex h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98]";

/**
 * After they subscribe: "Install the app and make it 20% off". Like the newsletter pop-up: centred on
 * larger screens, a sheet from the bottom on phones. Without a discount to offer, it drops the 20%.
 */
export function InstallPopup({ open, onOpenChange, discount, onInstall }: { open: boolean; onOpenChange: (open: boolean) => void; discount: boolean; onInstall: () => void }) {
  const contentRef = useRef<HTMLDivElement>(null);
  useLenisLock(open);
  const ticks = [
    ...(discount ? ["20% off your next order (10% + 10%)"] : []),
    "Notifications when we reply or your order ships",
    "One tap from your home screen",
  ];
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[var(--z-overlay)] bg-black/55 supports-backdrop-filter:backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          ref={contentRef}
          data-lenis-prevent
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            contentRef.current?.focus();
          }}
          className={cn(
            "fixed inset-x-0 bottom-0 z-[var(--z-overlay)] max-h-[100dvh] overflow-y-auto rounded-t-[22px] border border-b-0 border-border bg-surface text-foreground shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] outline-none",
            "duration-300 data-open:animate-in data-open:slide-in-from-bottom-10 data-open:fade-in-0 data-closed:animate-out data-closed:slide-out-to-bottom-10 data-closed:fade-out-0",
            "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[440px] sm:max-w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:overflow-hidden sm:rounded-[22px] sm:border-b",
            "sm:data-open:slide-in-from-bottom-0 sm:data-open:zoom-in-95 sm:data-closed:slide-out-to-bottom-0 sm:data-closed:zoom-out-95"
          )}
        >
          <div aria-hidden className={cn("px-6 py-5 text-center", ART)}>
            <p className="font-display text-4xl leading-none font-black tracking-tight">{discount ? "+10% MORE" : "THE APP"}</p>
            <p className="mt-1.5 text-xs font-extrabold tracking-[0.2em]">{discount ? "INSTALL THE APP" : "ONE TAP AWAY"}</p>
          </div>
          <div className="relative px-6 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <p className="text-[10px] font-bold tracking-[0.2em] text-primary-ink">YOU&apos;RE SUBSCRIBED</p>
            <DialogPrimitive.Title className="mt-2 pr-8 font-display text-[22px] leading-tight font-semibold">
              {discount ? "Install the app and make it 20% off" : "Install the app"}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description asChild>
              <ul className="mt-3 grid gap-2 text-sm">
                {ticks.map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <CheckIcon weight="bold" className="mt-0.5 size-4 shrink-0 text-primary-ink" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </DialogPrimitive.Description>
            <button type="button" onClick={onInstall} className={cn(PILL, "mt-5")}>
              Install the app
            </button>
            <DialogPrimitive.Close className="mx-auto mt-2 flex h-10 items-center px-3 text-sm text-muted-foreground transition-colors hover:text-foreground">Not now</DialogPrimitive.Close>
            <DialogPrimitive.Close
              aria-label="Close"
              className="absolute top-3 right-3 grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <XIcon className="size-[18px]" aria-hidden />
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
