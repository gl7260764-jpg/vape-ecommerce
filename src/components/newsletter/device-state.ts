// What this browser remembers about the newsletter pop-up: localStorage["bvsa-newsletter"].
import type { PopupDeviceState } from "@/lib/newsletter-schedule";

const KEY = "bvsa-newsletter";
/** Fired on window when this device subscribes, so a waiting pop-up stands down. */
export const NEWSLETTER_SUBSCRIBED_EVENT = "bvsa-newsletter-subscribed";

// With storage blocked, the state lives for this page only.
let memory: PopupDeviceState = { subscribed: false, shows: 0, lastClosedAt: null };

export function readDevice(): PopupDeviceState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return memory;
    const v = JSON.parse(raw);
    return {
      subscribed: v?.subscribed === true,
      shows: Number.isFinite(v?.shows) ? v.shows : 0,
      lastClosedAt: Number.isFinite(v?.lastClosedAt) ? v.lastClosedAt : null,
    };
  } catch {
    return memory;
  }
}

export function updateDevice(change: Partial<PopupDeviceState>): PopupDeviceState {
  memory = { ...readDevice(), ...change };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // storage blocked: memory still holds it
  }
  return memory;
}

/** Called by every sign-up form on the store: the pop-up never shows on this device again. */
export function markNewsletterSubscribed() {
  updateDevice({ subscribed: true });
  window.dispatchEvent(new Event(NEWSLETTER_SUBSCRIBED_EVENT));
}
