"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { XIcon } from "@phosphor-icons/react";
import type { AppPlatform } from "@/lib/app-platform";
import { useLenisLock } from "@/hooks/use-lenis-lock";

type Guide = { title: string; steps: React.ReactNode[]; note?: string };

// The steps for browsers that can't install with one tap.
function guideFor(platform: AppPlatform): Guide {
  switch (platform) {
    case "iphone":
    case "ipad":
      return {
        title: "Add Best Vape to your Home Screen",
        steps: [
          <>
            Tap <b>Share</b> (or <b>•••</b> then <b>Share</b>)
          </>,
          <>
            Tap <b>Add to Home Screen</b>
          </>,
          <>
            Tap <b>Add</b>, then open Best Vape from your Home Screen
          </>,
        ],
      };
    case "mac-safari":
      return {
        title: "Add Best Vape to your Dock",
        steps: [
          <>
            In the menu bar, choose <b>File</b> (or the <b>Share</b> button)
          </>,
          <>
            Choose <b>Add to Dock</b>
          </>,
          <>
            Click <b>Add</b>, then open Best Vape from your Dock
          </>,
        ],
      };
    case "in-app":
      return {
        title: "Open Best Vape in your browser",
        steps: [
          <>
            Tap <b>•••</b> or the menu in this app
          </>,
          <>
            Choose <b>Open in browser</b> (Safari or Chrome)
          </>,
          <>
            Then tap the <b>Install</b> button there
          </>,
        ],
        note: "Apps like Instagram and TikTok can't install other apps.",
      };
    default:
      return {
        title: "Install Best Vape",
        steps: [
          <>
            Open your browser&apos;s menu (<b>⋮</b> or <b>•••</b>)
          </>,
          <>
            Choose <b>Install app</b> (or <b>Add to Home screen</b>)
          </>,
          <>
            Confirm, then open Best Vape from your apps
          </>,
        ],
        note: platform === "firefox" ? "Firefox on computers can't install apps: use Chrome, Edge or Safari." : undefined,
      };
  }
}

/** How to install on this device, with the app's discount when there is one to promise. */
export function InstallGuide({ open, onOpenChange, platform, discount }: { open: boolean; onOpenChange: (open: boolean) => void; platform: AppPlatform; discount: boolean }) {
  useLenisLock(open);
  const guide = guideFor(platform);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[var(--z-overlay)] bg-black/55 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          data-lenis-prevent
          className="fixed inset-x-0 bottom-0 z-[var(--z-overlay)] max-h-[100dvh] overflow-y-auto rounded-t-[22px] border border-b-0 border-border bg-surface px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-foreground outline-none duration-300 data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-10 data-closed:animate-out data-closed:fade-out-0 sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[420px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[22px] sm:border-b sm:data-open:slide-in-from-bottom-0 sm:data-open:zoom-in-95"
        >
          <DialogPrimitive.Title className="pr-10 font-display text-xl leading-tight font-semibold">{guide.title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Steps to install the store as an app on this device.</DialogPrimitive.Description>
          <ol className="mt-4 grid gap-2">
            {guide.steps.map((step, i) => (
              <li key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-background/60 px-3.5 py-3 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          {guide.note && <p className="mt-3 text-xs text-muted-foreground">{guide.note}</p>}
          {discount && <p className="mt-3 text-sm text-muted-foreground">Your 10% is added once you open the app.</p>}
          <DialogPrimitive.Close className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98]">
            Got it
          </DialogPrimitive.Close>
          <DialogPrimitive.Close
            aria-label="Close"
            className="absolute top-4 right-4 grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <XIcon className="size-[18px]" aria-hidden />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
