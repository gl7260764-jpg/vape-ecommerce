"use client";

import { BellRingingIcon } from "@phosphor-icons/react";
import { useNotifications } from "@/components/app/use-notifications";

/** On the account page: turn notifications on or off for this device. */
export function NotificationsCard() {
  const { state, turnOn, turnOff } = useNotifications();
  if (state === "unsupported" || state === "loading") return null;
  return (
    <div className="mt-6 flex flex-wrap items-center gap-4 rounded-[var(--radius-tile)] border border-border bg-surface p-6 md:p-7">
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/15 text-primary-ink">
        <BellRingingIcon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-lg font-bold uppercase">Notifications</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {state === "on"
            ? "On for this device: we'll tell you when we reply, your order ships, or new products land."
            : state === "blocked"
              ? "Notifications are blocked in your settings. Allow them for this site to turn them on."
              : "Get told when we reply, your order ships, or new products land."}
        </p>
      </div>
      {state === "off" && (
        <button type="button" onClick={() => void turnOn()} className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
          Turn on notifications
        </button>
      )}
      {state === "on" && (
        <button type="button" onClick={() => void turnOff()} className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Turn off
        </button>
      )}
    </div>
  );
}
