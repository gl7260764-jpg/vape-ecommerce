"use client";

import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useInstall, useInstallIconShown } from "@/components/app/install-store";

/** The navbar's install icon: pulses until the app is installed; does what the card's Install does. */
export function InstallButton() {
  const shown = useInstallIconShown();
  const start = useInstall((s) => s.start);
  if (!shown) return null;
  return (
    <button
      type="button"
      onClick={() => void start()}
      aria-label="Install the app"
      title="Install the app"
      className="relative grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95 sm:size-10"
    >
      <span aria-hidden className="absolute inset-0 rounded-full bg-primary/50 motion-safe:animate-ping" />
      <DownloadSimpleIcon weight="bold" className="relative size-[18px]" aria-hidden />
    </button>
  );
}
