"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AGE_CONFIRMED_EVENT, AGE_STORAGE_KEY } from "@/components/site/age-gate";
import { NEWSLETTER_SUBSCRIBED_EVENT, readDevice, updateDevice } from "@/components/newsletter/device-state";
import type { NewsletterSettingsValues } from "@/lib/newsletter";
import { nextShowDelay } from "@/lib/newsletter-schedule";
import { isQuietRoute } from "@/lib/quiet-routes";

// The dialog's code loads only when it's about to open.
const NewsletterPopup = dynamic(() => import("@/components/newsletter/newsletter-popup").then((m) => m.NewsletterPopup), { ssr: false });


function ageConfirmed() {
  try {
    return window.localStorage.getItem(AGE_STORAGE_KEY) === "yes";
  } catch {
    return false;
  }
}

// Another dialog (cart, chat) is open: wait for it to close instead of covering it.
const otherDialogOpen = () => document.querySelector('[role="dialog"][data-state="open"]') !== null;

/** Opens the newsletter pop-up on the owner's schedule (Admin > Settings > Newsletter pop-up). */
export function PopupTrigger({ settings }: { settings: NewsletterSettingsValues }) {
  const pathname = usePathname();
  const hidden = isQuietRoute(pathname); // never in the middle of buying
  const [ageOk, setAgeOk] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- storage is only readable after mount
    setAgeOk(ageConfirmed());
    setSubscribed(readDevice().subscribed);
    const onAge = () => setAgeOk(true);
    const onSubscribed = () => setSubscribed(true);
    window.addEventListener(AGE_CONFIRMED_EVENT, onAge);
    window.addEventListener(NEWSLETTER_SUBSCRIBED_EVENT, onSubscribed);
    return () => {
      window.removeEventListener(AGE_CONFIRMED_EVENT, onAge);
      window.removeEventListener(NEWSLETTER_SUBSCRIBED_EVENT, onSubscribed);
    };
  }, []);

  useEffect(() => {
    if (!ageOk || hidden || open || subscribed) return;
    // Counted from when this page could first show it: after the age check, or on leaving checkout.
    const loadedAt = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const show = () => {
      if (nextShowDelay(readDevice(), settings, Date.now(), loadedAt) === null) return;
      if (otherDialogOpen()) {
        timer = setTimeout(show, 1000);
        return;
      }
      updateDevice({ shows: readDevice().shows + 1 });
      setLoaded(true);
      setOpen(true);
    };
    const delay = nextShowDelay(readDevice(), settings, loadedAt, loadedAt);
    if (delay === null) return;
    timer = setTimeout(show, delay);
    return () => clearTimeout(timer);
  }, [ageOk, hidden, open, subscribed, settings]);

  const onOpenChange = useCallback((next: boolean) => {
    if (!next && !readDevice().subscribed) updateDevice({ lastClosedAt: Date.now() });
    setOpen(next);
  }, []);

  // Back (or any navigation) onto checkout or an order page closes it, like a ✕.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacts to the route changing under an open pop-up
    if (hidden && open) onOpenChange(false);
  }, [hidden, open, onOpenChange]);

  // Stays mounted after the first show so closing can animate.
  return loaded ? <NewsletterPopup open={open} onOpenChange={onOpenChange} /> : null;
}
