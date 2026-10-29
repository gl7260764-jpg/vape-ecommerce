"use client";

import { BellRingingIcon, CheckIcon } from "@phosphor-icons/react";
import { useNotifications } from "@/components/app/use-notifications";

/**
 * In the chat, under the thanks for confirming an invoice: turn on notifications, so the payment details
 * reach the customer even after they leave. Only where the browser can (on iPhone and iPad, inside the app).
 */
export function NotifyCard() {
  const { state, turnOn } = useNotifications();
  if (state === "unsupported" || state === "loading") return null;
  return (
    <li className="flex justify-center px-3 py-1.5">
      {state === "on" ? (
        <div className="w-full max-w-sm rounded-[var(--radius-tile)] border border-border bg-surface px-4 py-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-primary-ink">
            <CheckIcon weight="bold" className="size-4" aria-hidden />
            Notifications on
          </p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">We&apos;ll tell you the moment your payment details arrive.</p>
        </div>
      ) : (
        <div className="w-full max-w-sm rounded-[var(--radius-tile)] border border-border bg-surface p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary-ink">
              <BellRingingIcon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-display font-bold uppercase">Don&apos;t miss your payment details</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {state === "blocked"
                  ? "Notifications are blocked for this site. Allow them in your browser's settings to hear when they land."
                  : "They'll land in this chat in a few minutes. Get a notification when they do, even if you close this page."}
              </p>
            </div>
          </div>
          {state === "off" && (
            <button
              type="button"
              onClick={() => void turnOn()}
              className="mt-3.5 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
            >
              <BellRingingIcon className="size-4.5" aria-hidden />
              Turn on notifications
            </button>
          )}
        </div>
      )}
    </li>
  );
}
