"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLenisLock } from "@/hooks/use-lenis-lock";
import { Logo } from "@/components/site/logo";

export const AGE_STORAGE_KEY = "bvsa-age-confirmed";
/** Fired on window when the visitor confirms their age, so the newsletter pop-up can start counting. */
export const AGE_CONFIRMED_EVENT = "bvsa-age-confirmed";

export function AgeGate() {
  const [open, setOpen] = useState(false);
  const [declined, setDeclined] = useState(false);
  useLenisLock(open);

  useEffect(() => {
    let confirmed = false;
    try {
      confirmed = window.localStorage.getItem(AGE_STORAGE_KEY) === "yes";
    } catch {
      // storage blocked: ask every visit
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- storage is only readable after mount
    if (!confirmed) setOpen(true);
  }, []);

  const confirm = () => {
    try {
      window.localStorage.setItem(AGE_STORAGE_KEY, "yes");
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event(AGE_CONFIRMED_EVENT));
    setOpen(false);
  };

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="max-w-[calc(100%-2rem)] gap-0 overflow-hidden rounded-[var(--radius-tile)] border-border bg-surface p-0 sm:max-w-md"
      >
        <div className="relative px-7 pt-8 pb-7 sm:px-9">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 left-1/2 size-64 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
          />
          <Logo className="relative" />
          {declined ? (
            <div className="relative mt-8">
              <DialogTitle className="font-display text-2xl leading-tight font-semibold uppercase">
                Sorry, adults only
              </DialogTitle>
              <DialogDescription className="mt-3 text-base leading-relaxed text-muted-foreground">
                You need to be 18 or older to visit this store. Want help to quit? Call Quitline on 13 7848.
              </DialogDescription>
            </div>
          ) : (
            <div className="relative mt-8">
              <DialogTitle className="font-display text-2xl leading-tight font-semibold uppercase">
                Are you 18 or older?
              </DialogTitle>
              <DialogDescription className="mt-3 text-base leading-relaxed text-muted-foreground">
                This store sells nicotine products. You must be of legal age to enter.
              </DialogDescription>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <Button
                  onClick={confirm}
                  className="h-12 rounded-full text-base font-semibold active:scale-[0.98]"
                >
                  Yes, I&apos;m 18+
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDeclined(true)}
                  className="h-12 rounded-full border-border bg-transparent text-base active:scale-[0.98]"
                >
                  No
                </Button>
              </div>
            </div>
          )}
        </div>
        <p className="border-t border-border bg-background/60 px-7 py-4 text-xs leading-relaxed text-muted-foreground sm:px-9">
          Nicotine is highly addictive. Keep out of reach of children.
        </p>
      </DialogContent>
    </Dialog>
  );
}
