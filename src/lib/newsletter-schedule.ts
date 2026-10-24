// When the newsletter pop-up shows next on this device. Pure, so the browser and the tests share it.
import type { NewsletterSettingsValues } from "@/lib/newsletter";

/** What the browser remembers in localStorage["bvsa-newsletter"]. */
export type PopupDeviceState = { subscribed: boolean; shows: number; lastClosedAt: number | null };

/**
 * Milliseconds until the pop-up should open, or null for never (switched off, subscribed, or
 * shown the set number of times). loadedAt is when this page became eligible to show it.
 * A "show it again" countdown still running at load carries on; otherwise it waits the first delay.
 */
export function nextShowDelay(state: PopupDeviceState, settings: NewsletterSettingsValues, now: number, loadedAt: number): number | null {
  if (!settings.popupEnabled || state.subscribed) return null;
  if (settings.maxShows !== null && state.shows >= settings.maxShows) return null;
  const firstAt = loadedAt + settings.firstDelaySeconds * 1000;
  const againAt = state.lastClosedAt === null ? null : state.lastClosedAt + settings.repeatEverySeconds * 1000;
  const at = againAt !== null && againAt > loadedAt ? againAt : firstAt;
  return Math.max(0, at - now);
}
