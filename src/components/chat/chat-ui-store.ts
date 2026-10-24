"use client";

import { create } from "zustand";

/** How long a customer stays connected for live replies after sending, with the panel closed. */
export const LINGER_MS = 10 * 60_000;

type ChatUi = {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Something asked for the chat (the order page, a "Chat with us" button) before it was ready. */
  pendingOpen: boolean;
  requestOpen: () => void;
  /** True for 10 minutes after the customer's last send: replies still arrive live with the panel closed. */
  lingering: boolean;
  markSent: () => void;
  /** Bumped after signing in or out, so the chat button checks this device's chat again straight away. */
  statusVersion: number;
  reloadStatus: () => void;
  /** This device is signed into an account (so it has a chat), and the team's messages it hasn't read. */
  signedIn: boolean;
  unread: number;
  setStatus: (status: { signedIn: boolean; unread: number }) => void;
};

let lingerTimer: ReturnType<typeof setTimeout> | null = null;

export const useChatUi = create<ChatUi>()((set) => ({
  open: false,
  setOpen: (open) => set({ open, pendingOpen: false }),
  pendingOpen: false,
  requestOpen: () => set({ pendingOpen: true }),
  lingering: false,
  markSent: () => {
    if (lingerTimer) clearTimeout(lingerTimer);
    lingerTimer = setTimeout(() => set({ lingering: false }), LINGER_MS);
    set({ lingering: true });
  },
  statusVersion: 0,
  reloadStatus: () => set((s) => ({ statusVersion: s.statusVersion + 1 })),
  signedIn: false,
  unread: 0,
  setStatus: ({ signedIn, unread }) => set({ signedIn, unread }),
}));
