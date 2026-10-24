"use client";

import Image from "next/image";
import Link from "next/link";
import { XIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// A card that waits at the bottom of the page. Not a dialog: it never blocks the page or a pop-up.
const CARD =
  "fixed inset-x-3 bottom-3 z-[var(--z-header)] flex items-center gap-3 rounded-2xl border border-border bg-surface/95 p-3 pr-2 shadow-[0_20px_50px_-20px_var(--shadow-strong)] backdrop-blur supports-backdrop-filter:bg-surface/85 sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-[380px] " +
  // Above the product page's sticky buy bar on phones.
  "[body:has([data-sticky-bar=shown])_&]:bottom-24 lg:[body:has([data-sticky-bar=shown])_&]:bottom-6 " +
  "animate-in fade-in-0 slide-in-from-bottom-4 duration-300";

function Card({ label, title, text, action, onClose }: { label: string; title: string; text: string; action: React.ReactNode; onClose: () => void }) {
  return (
    <aside aria-label={label} className={CARD}>
      <Image src="/icons/icon-192.png" alt="" width={44} height={44} className="size-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug font-semibold">{title}</p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{text}</p>
      </div>
      {action}
      <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground">
        <XIcon className="size-4" aria-hidden />
      </button>
    </aside>
  );
}

const PILL = "inline-flex h-9 shrink-0 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.97]";

/** "Get the app, get 10% off": from the first visit until they subscribe (then the pop-up takes over). */
export function InstallCard({ discount, onInstall, onClose }: { discount: boolean; onInstall: () => void; onClose: () => void }) {
  return (
    <Card
      label="Get the app"
      title={discount ? "Get the app, get 10% off" : "Get the app"}
      text="Faster ordering and order updates."
      onClose={onClose}
      action={
        <button type="button" onClick={onInstall} className={PILL}>
          Install
        </button>
      }
    />
  );
}

/** Inside the installed app, once: an app that started without the browser's account asks for the email. */
export function AppSignInCard({ onClose }: { onClose: () => void }) {
  return (
    <Card
      label="Keep your app discount"
      title="Sign in with your email to keep your app's 10%"
      text="It works wherever you order, on any device."
      onClose={onClose}
      action={
        <Link href="/account" onClick={onClose} className={cn(PILL, "px-3.5")}>
          Open your account
        </Link>
      }
    />
  );
}
