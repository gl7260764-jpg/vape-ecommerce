"use client";

import { useRef, useState, useTransition } from "react";
import { ConfettiIcon, EnvelopeSimpleIcon, XIcon } from "@phosphor-icons/react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { subscribeFromPopup } from "@/app/actions/newsletter";
import { useChatUi } from "@/components/chat/chat-ui-store";
import { markNewsletterSubscribed } from "@/components/newsletter/device-state";
import { useLenisLock } from "@/hooks/use-lenis-lock";
import { cn } from "@/lib/utils";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ART = "bg-[radial-gradient(circle_at_30%_30%,#e6ff7a,#a8cc1c_55%,#5e7a07)] text-[#121408]";
const PILL = "inline-flex h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-80";

type Done = { email: string; discount: "saved" | "used" };

/** "Get 10% off your next order": centred on larger screens, a sheet from the bottom on phones. */
export function NewsletterPopup({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [pending, startTransition] = useTransition();
  const contentRef = useRef<HTMLDivElement>(null);
  useLenisLock(open);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL.test(value)) {
      setError("Enter a valid email, like name@example.com.");
      return;
    }
    startTransition(async () => {
      const result = await subscribeFromPopup({ email: value }).catch(() => ({ ok: false as const, error: "We couldn't save that just now. Please try again." }));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      markNewsletterSubscribed();
      useChatUi.getState().reloadStatus(); // subscribing opened their account: show the message icon
      setDone({ email: value.toLowerCase(), discount: result.discount });
    });
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[var(--z-overlay)] bg-black/55 supports-backdrop-filter:backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          ref={contentRef}
          data-lenis-prevent
          // Focus the dialog, not the email box, so phones don't throw up the keyboard uninvited.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            contentRef.current?.focus();
          }}
          className={cn(
            "fixed inset-x-0 bottom-0 z-[var(--z-overlay)] max-h-[100dvh] overflow-y-auto rounded-t-[22px] border border-b-0 border-border bg-surface text-foreground shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] outline-none",
            "duration-300 data-open:animate-in data-open:slide-in-from-bottom-10 data-open:fade-in-0 data-closed:animate-out data-closed:slide-out-to-bottom-10 data-closed:fade-out-0",
            "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[560px] sm:max-w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:overflow-hidden sm:rounded-[22px] sm:border-b",
            "sm:data-open:slide-in-from-bottom-0 sm:data-open:zoom-in-95 sm:data-closed:slide-out-to-bottom-0 sm:data-closed:zoom-out-95",
            !done && "sm:grid sm:grid-cols-[210px_1fr]"
          )}
        >
          {done ? (
            <div className="relative px-6 pt-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-8">
              <ConfettiIcon weight="duotone" className="size-9 text-primary-ink" aria-hidden />
              {done.discount === "saved" ? (
                <>
                  <DialogPrimitive.Title className="mt-3 font-display text-2xl leading-tight font-semibold">You&apos;re in!</DialogPrimitive.Title>
                  <DialogPrimitive.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    10% off your next order is saved to <b className="font-semibold break-words text-foreground">{done.email}</b>. Use that email at checkout and it comes off automatically.
                  </DialogPrimitive.Description>
                </>
              ) : (
                <>
                  <DialogPrimitive.Title className="mt-3 font-display text-2xl leading-tight font-semibold">You&apos;re subscribed.</DialogPrimitive.Title>
                  <DialogPrimitive.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Your 10% welcome discount was already used on an earlier order.
                  </DialogPrimitive.Description>
                </>
              )}
              <DialogPrimitive.Close className={cn(PILL, "mt-6")}>Start shopping</DialogPrimitive.Close>
            </div>
          ) : (
            <>
              <div aria-hidden className={cn("grid place-items-center px-6 py-4 sm:py-0", ART)}>
                <div className="text-center">
                  <p className="font-display text-4xl leading-[0.9] font-black tracking-tight sm:text-[64px]">
                    10%
                    <span className="sm:hidden"> </span>
                    <br className="hidden sm:block" />
                    OFF
                  </p>
                  <p className="mt-2 hidden text-xs font-extrabold tracking-[0.2em] sm:block">YOUR NEXT ORDER</p>
                </div>
              </div>
              <div className="relative px-6 pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-7 sm:pb-6">
                <p className="text-[10px] font-bold tracking-[0.2em] text-primary-ink">NEWSLETTER</p>
                <DialogPrimitive.Title className="mt-2 pr-8 font-display text-[22px] leading-tight font-semibold">Get 10% off your next order</DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Subscribe for new releases, restocks and deals. Your 10% is applied automatically at checkout.
                </DialogPrimitive.Description>
                <form onSubmit={onSubmit} noValidate className="mt-4">
                  <label htmlFor="popup-email" className="sr-only">
                    Your email
                  </label>
                  <div className="flex h-12 items-center gap-2 rounded-full border border-input bg-background/60 px-4 transition-colors focus-within:border-primary">
                    <EnvelopeSimpleIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <input
                      id="popup-email"
                      type="email"
                      autoComplete="email"
                      placeholder="Your email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError(null);
                      }}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? "popup-email-error" : undefined}
                      className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
                    />
                  </div>
                  {error && (
                    <p id="popup-email-error" role="alert" className="mt-2 text-sm text-destructive">
                      {error}
                    </p>
                  )}
                  <button type="submit" disabled={pending} className={cn(PILL, "mt-3")}>
                    {pending ? "Saving..." : "Subscribe and save 10%"}
                  </button>
                </form>
                <DialogPrimitive.Close className="mx-auto mt-2 flex h-10 items-center px-3 text-sm text-muted-foreground transition-colors hover:text-foreground">No thanks</DialogPrimitive.Close>
                <p className="mt-1 text-center text-[11px] leading-snug text-muted-foreground/80 sm:text-left">One discount per email. Unsubscribe any time.</p>
                <DialogPrimitive.Close
                  aria-label="Close"
                  className="absolute top-3 right-3 grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                >
                  <XIcon className="size-[18px]" aria-hidden />
                </DialogPrimitive.Close>
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
