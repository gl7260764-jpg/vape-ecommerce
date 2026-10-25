// What this browser remembers about the install offers. localStorage["bvsa-install"] keeps the pop-up's
// schedule and whether the install was recorded; sessionStorage keeps the card's ✕ for this visit.
const KEY = "bvsa-install";
const CARD_KEY = "bvsa-install-card";

export type InstallDeviceState = { shows: number; lastClosedAt: number | null; recorded: boolean; signInAsked: boolean; notifyAsked: boolean };

let memory: InstallDeviceState = { shows: 0, lastClosedAt: null, recorded: false, signInAsked: false, notifyAsked: false };

export function readInstallDevice(): InstallDeviceState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return memory;
    const v = JSON.parse(raw);
    return {
      shows: Number.isFinite(v?.shows) ? v.shows : 0,
      lastClosedAt: Number.isFinite(v?.lastClosedAt) ? v.lastClosedAt : null,
      recorded: v?.recorded === true,
      signInAsked: v?.signInAsked === true,
      notifyAsked: v?.notifyAsked === true,
    };
  } catch {
    return memory;
  }
}

export function updateInstallDevice(change: Partial<InstallDeviceState>): InstallDeviceState {
  memory = { ...readInstallDevice(), ...change };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // storage blocked: memory still holds it for this page
  }
  return memory;
}

let cardHidden = false;

/** The card's ✕ hides it until the next visit (a new browser session). */
export function cardDismissed(): boolean {
  try {
    return cardHidden || window.sessionStorage.getItem(CARD_KEY) === "hidden";
  } catch {
    return cardHidden;
  }
}

export function dismissCard() {
  cardHidden = true;
  try {
    window.sessionStorage.setItem(CARD_KEY, "hidden");
  } catch {
    // storage blocked: hidden for this page
  }
}
