"use client";

import { useCallback, useEffect, useState } from "react";
import { disableNotifications, enableNotifications } from "@/app/actions/push";
import { useInstall } from "@/components/app/install-store";
import { installPlatformLabel } from "@/lib/app-platform";

export type NotificationsState = "unsupported" | "loading" | "off" | "on" | "blocked";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

const keyBytes = (base64url: string) => {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
};

/**
 * Notifications on this device. Unsupported without the store's keys, a service worker or the Push API;
 * on iPhone and iPad that means only inside the installed app.
 */
export function useNotifications() {
  const isApp = useInstall((s) => s.isApp);
  const [state, setState] = useState<NotificationsState>("loading");

  const refresh = useCallback(async () => {
    try {
      if (!PUBLIC_KEY || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
      if (Notification.permission === "denied") return setState("blocked");
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      setState(subscription && Notification.permission === "granted" ? "on" : "off");
    } catch {
      setState("unsupported");
    }
  }, []);

  // Checked after mount (and again inside the app), when the browser's APIs can be read.
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh, isApp]);

  /** From a tap only: browsers ask for permission, then the device subscribes. */
  const turnOn = useCallback(async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "blocked" : "off");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) });
      const json = subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const platform = installPlatformLabel({ userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints ?? 0 });
      const result = await enableNotifications({ endpoint: json.endpoint, keys: json.keys, platform });
      setState(result.ok ? "on" : "off");
    } catch {
      setState("off");
    }
  }, []);

  const turnOff = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await disableNotifications({ endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
    } finally {
      setState("off");
    }
  }, []);

  return { state, turnOn, turnOff };
}
