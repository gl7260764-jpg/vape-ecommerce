"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import type { ConversationDTO } from "@/lib/chat/types";

// The admin's inbox, shared by the Chats list, the sidebar badge and the new-message alerts.

type InboxState = {
  conversations: ConversationDTO[];
  unreadTotal: number;
  /** Server time of the last load, for "online" dots. */
  now: string | null;
  loaded: boolean;
  q: string;
  unreadOnly: boolean;
  setQuery: (q: string) => void;
  setUnreadOnly: (unreadOnly: boolean) => void;
  load: () => Promise<void>;
};

let request = 0;

export const useAdminChat = create<InboxState>()((set, get) => ({
  conversations: [],
  unreadTotal: 0,
  now: null,
  loaded: false,
  q: "",
  unreadOnly: false,
  setQuery: (q) => {
    set({ q });
    void get().load();
  },
  setUnreadOnly: (unreadOnly) => {
    set({ unreadOnly });
    void get().load();
  },
  load: async () => {
    const mine = ++request;
    const { q, unreadOnly } = get();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (unreadOnly) params.set("unread", "1");
    try {
      const res = await fetch(`/admin/api/chat/inbox${params.size ? `?${params}` : ""}`, { cache: "no-store" });
      if (!res.ok || mine !== request) return;
      const data = (await res.json()) as { conversations: ConversationDTO[]; unreadTotal: number; now: string };
      if (mine !== request) return; // a newer search answered first
      set({ conversations: data.conversations, unreadTotal: data.unreadTotal, now: data.now, loaded: true });
    } catch {
      // Offline: the next poll tries again.
    }
  },
}));

// Per-browser alert preferences in localStorage: sound on by default, notifications off until allowed.
const PREF_EVENT = "bvsa-chat-pref";
export const PREFS = { muted: "bvsa-chat-muted", notify: "bvsa-chat-notify" } as const;

export function readPref(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function writePref(key: string, on: boolean) {
  try {
    if (on) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    // Private mode: the choice lasts until the tab closes.
  }
  window.dispatchEvent(new Event(PREF_EVENT));
}

function subscribe(fn: () => void) {
  window.addEventListener(PREF_EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(PREF_EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}

export function usePref(key: string): [boolean, (on: boolean) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => readPref(key),
    () => false
  );
  return [value, (on: boolean) => writePref(key, on)];
}
