"use client";

import { create } from "zustand";
import { appPlatform, type AppPlatform } from "@/lib/app-platform";

type InstallState = {
  /** Read once the browser has been checked (after mount). */
  ready: boolean;
  platform: AppPlatform;
  /** The browser kept its own install prompt for us (Chrome, Edge, Samsung Internet). */
  canPrompt: boolean;
  /** This page is running as the installed app. */
  isApp: boolean;
  /** Installed just now from this tab (Chromium tells us). */
  installed: boolean;
  /** The owner's switch (Admin › Settings › Newsletter pop-up). */
  offersOn: boolean;
  setOffersOn: (on: boolean) => void;
  /** On a page where nothing pops up (checkout, orders, account, invoices); set by the offers controller. */
  quiet: boolean;
  setQuiet: (quiet: boolean) => void;
  /** The steps for this device, for browsers that can't install with one tap. */
  guideOpen: boolean;
  setGuideOpen: (open: boolean) => void;
  init: () => void;
  prompt: () => Promise<"accepted" | "dismissed" | "unavailable">;
  /** Every Install button: the browser's own prompt where it has one, otherwise the steps. */
  start: () => Promise<void>;
};

const runningAsApp = () => {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  } catch {
    return false;
  }
};

/** What this browser can do about installing the store, shared by the card, the navbar icon and the pop-up. */
export const useInstall = create<InstallState>()((set, get) => ({
  ready: false,
  platform: "other",
  canPrompt: false,
  isApp: false,
  installed: false,
  offersOn: false,
  setOffersOn: (on) => set({ offersOn: on }),
  quiet: true,
  setQuiet: (quiet) => set({ quiet }),
  guideOpen: false,
  setGuideOpen: (open) => set({ guideOpen: open }),
  init: () => {
    if (get().ready) return;
    set({
      ready: true,
      platform: appPlatform({ userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints ?? 0 }),
      isApp: runningAsApp(),
      canPrompt: Boolean(window.__bvsaInstallPrompt),
    });
    window.addEventListener("bvsa-install-ready", () => set({ canPrompt: true }));
    window.addEventListener("bvsa-app-installed", () => set({ canPrompt: false, installed: true }));
  },
  prompt: async () => {
    const event = window.__bvsaInstallPrompt;
    if (!event) return "unavailable";
    await event.prompt();
    const { outcome } = await event.userChoice;
    window.__bvsaInstallPrompt = null; // a prompt can only be used once
    set({ canPrompt: false, installed: outcome === "accepted" });
    return outcome;
  },
  start: async () => {
    const outcome = get().canPrompt ? await get().prompt().catch(() => "unavailable" as const) : "unavailable";
    if (outcome === "unavailable") set({ guideOpen: true });
  },
}));

/** Whether the navbar's install icon shows (the header also uses it to make room on small phones). */
export const useInstallIconShown = () => useInstall((s) => s.ready && s.offersOn && !s.isApp && !s.installed && !s.quiet);
