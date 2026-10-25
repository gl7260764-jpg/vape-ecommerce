"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { recordInstall } from "@/app/actions/app";
import { AppSignInCard, InstallCard, NotifyCard } from "@/components/app/offer-cards";
import { useNotifications } from "@/components/app/use-notifications";
import { cardDismissed, dismissCard, readInstallDevice, updateInstallDevice } from "@/components/app/install-device";
import { useInstall } from "@/components/app/install-store";
import { NEWSLETTER_SUBSCRIBED_EVENT, readDevice } from "@/components/newsletter/device-state";
import { AGE_CONFIRMED_EVENT, AGE_STORAGE_KEY } from "@/components/site/age-gate";
import { installPlatformLabel } from "@/lib/app-platform";
import type { NewsletterSettingsValues } from "@/lib/newsletter";
import { nextShowDelay } from "@/lib/newsletter-schedule";
import { isQuietRoute } from "@/lib/quiet-routes";

// Both dialogs load only when they're about to open.
const InstallPopup = dynamic(() => import("@/components/app/install-popup").then((m) => m.InstallPopup), { ssr: false });
const InstallGuide = dynamic(() => import("@/components/app/install-guide").then((m) => m.InstallGuide), { ssr: false });

type OffersStatus = { welcomeUsed: boolean; signedIn: boolean; installed: boolean };

function ageConfirmed() {
  try {
    return window.localStorage.getItem(AGE_STORAGE_KEY) === "yes";
  } catch {
    return false;
  }
}

const otherDialogOpen = () => document.querySelector('[role="dialog"][data-state="open"]') !== null;

/**
 * The app install offers (Admin › Settings › Newsletter pop-up): before they subscribe, a card at the
 * bottom; after, a pop-up on the newsletter pop-up's timing; inside the installed app, nothing but a
 * one-time "sign in to keep your 10%", and the install is recorded.
 */
export function AppOffers({ settings }: { settings: NewsletterSettingsValues }) {
  const quiet = isQuietRoute(usePathname());
  const { ready, isApp, installed, platform, guideOpen, init, setOffersOn, setQuiet, setGuideOpen, setInstalledElsewhere, start } = useInstall();
  const offersOn = settings.installOffersEnabled;
  const [ageOk, setAgeOk] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [cardHidden, setCardHidden] = useState(true);
  const [askHidden, setAskHidden] = useState(true);
  const [notifyHidden, setNotifyHidden] = useState(true);
  const notifications = useNotifications();
  const [status, setStatus] = useState<OffersStatus | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupLoaded, setPopupLoaded] = useState(false);
  const [guideLoaded, setGuideLoaded] = useState(false);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- storage is only readable after mount
    setAgeOk(ageConfirmed());
    setSubscribed(readDevice().subscribed);
    setCardHidden(cardDismissed());
    setAskHidden(readInstallDevice().signInAsked);
    setNotifyHidden(readInstallDevice().notifyAsked);
    const onAge = () => setAgeOk(true);
    const onSubscribed = () => setSubscribed(true);
    window.addEventListener(AGE_CONFIRMED_EVENT, onAge);
    window.addEventListener(NEWSLETTER_SUBSCRIBED_EVENT, onSubscribed);
    return () => {
      window.removeEventListener(AGE_CONFIRMED_EVENT, onAge);
      window.removeEventListener(NEWSLETTER_SUBSCRIBED_EVENT, onSubscribed);
    };
  }, [init]);

  useEffect(() => setOffersOn(offersOn), [offersOn, setOffersOn]);
  // The navbar's install icon reads this (the header itself sits outside Suspense, so it can't read the path).
  useEffect(() => setQuiet(quiet), [quiet, setQuiet]);

  // What the offers may promise: no discount once this device's account has used its welcome discount.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetch("/api/app/status", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<OffersStatus>) : null))
      .then((s) => {
        if (cancelled || !s) return;
        setStatus(s);
        setInstalledElsewhere(s.installed); // installed already: the offers stop here too
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ready, subscribed, isApp, setInstalledElsewhere]);

  // Running as the installed app (or installed just now from this tab): remember it once, for the 10% and the team.
  // The app's first page view may not be stored yet, so it tries again a few times.
  useEffect(() => {
    if (!ready || !(isApp || installed)) return;
    const platformName = installPlatformLabel({ userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints ?? 0 });
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const attempt = () => {
      if (readInstallDevice().recorded) return;
      void recordInstall({ platform: platformName })
        .then((r) => (r.ok ? updateInstallDevice({ recorded: true }) : ++tries < 5 && (timer = setTimeout(attempt, 3000))))
        .catch(() => ++tries < 5 && (timer = setTimeout(attempt, 3000)));
    };
    attempt();
    return () => clearTimeout(timer);
  }, [ready, isApp, installed]);

  // After subscribing: the install pop-up, on the newsletter pop-up's timing, never over another dialog.
  const popupWanted = ready && offersOn && subscribed && ageOk && !quiet && !isApp && !installed && status !== null && !status.installed;
  useEffect(() => {
    if (!popupWanted || popupOpen) return;
    const timing = { ...settings, popupEnabled: true };
    const loadedAt = Date.now();
    const device = () => ({ ...readInstallDevice(), subscribed: false });
    let timer: ReturnType<typeof setTimeout>;
    const show = () => {
      if (nextShowDelay(device(), timing, Date.now(), loadedAt) === null) return;
      if (otherDialogOpen()) {
        timer = setTimeout(show, 1000);
        return;
      }
      updateInstallDevice({ shows: readInstallDevice().shows + 1 });
      setPopupLoaded(true);
      setPopupOpen(true);
    };
    const delay = nextShowDelay(device(), timing, loadedAt, loadedAt);
    if (delay === null) return;
    timer = setTimeout(show, delay);
    return () => clearTimeout(timer);
  }, [popupWanted, popupOpen, settings]);

  const onPopupOpenChange = useCallback((next: boolean) => {
    if (!next) updateInstallDevice({ lastClosedAt: Date.now() });
    setPopupOpen(next);
  }, []);

  // Back onto checkout (or anywhere quiet) closes it, like a ✕.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacts to the route changing under an open pop-up
    if (quiet && popupOpen) onPopupOpenChange(false);
  }, [quiet, popupOpen, onPopupOpenChange]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the steps load the first time they're asked for
    if (guideOpen) setGuideLoaded(true);
  }, [guideOpen]);

  const discount = !status?.welcomeUsed;
  const install = () => void start();
  // Shown once the server has said what it may promise, so a used discount is never offered, even for a moment.
  const showCard = ready && offersOn && ageOk && !quiet && !isApp && !installed && !subscribed && !cardHidden && status !== null && !status.installed;
  const showAsk = ready && ageOk && !quiet && isApp && !askHidden && status !== null && !status.signedIn && !status.welcomeUsed;
  // Once the sign-in question is out of the way, the app offers notifications once.
  const showNotify = ready && ageOk && !quiet && isApp && !showAsk && !notifyHidden && notifications.state === "off";
  const notifyDone = () => {
    updateInstallDevice({ notifyAsked: true });
    setNotifyHidden(true);
  };

  return (
    <>
      {showCard && (
        <InstallCard
          discount={discount}
          onInstall={install}
          onClose={() => {
            dismissCard();
            setCardHidden(true);
          }}
        />
      )}
      {showAsk && (
        <AppSignInCard
          onClose={() => {
            updateInstallDevice({ signInAsked: true });
            setAskHidden(true);
          }}
        />
      )}
      {showNotify && (
        <NotifyCard
          onTurnOn={() => {
            notifyDone();
            void notifications.turnOn();
          }}
          onClose={notifyDone}
        />
      )}
      {popupLoaded && (
        <InstallPopup
          open={popupOpen}
          onOpenChange={onPopupOpenChange}
          discount={discount}
          onInstall={() => {
            onPopupOpenChange(false);
            install();
          }}
        />
      )}
      {guideLoaded && <InstallGuide open={guideOpen} onOpenChange={setGuideOpen} platform={platform} discount={discount && !isApp} />}
    </>
  );
}
