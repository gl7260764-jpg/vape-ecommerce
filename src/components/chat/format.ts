"use client";

import { useSyncExternalStore } from "react";

// Times as people read them in a chat: "3:41 pm", "Today", "Yesterday", "Thu 23 Oct".

const time = new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit" });
const weekday = new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short" });
const withYear = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" });

export const timeOf = (iso: string) => time.format(new Date(iso));

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function dayLabel(iso: string, now: number) {
  const d = new Date(iso);
  const days = Math.round((dayStart(new Date(now)) - dayStart(d)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (new Date(now).getFullYear() !== d.getFullYear()) return withYear.format(d);
  return weekday.format(d).replace(",", "");
}

export function lastSeenText(iso: string, now: number) {
  const label = dayLabel(iso, now);
  const day = label === "Today" ? "today" : label === "Yesterday" ? "yesterday" : label;
  return `Last seen ${day} at ${timeOf(iso)}`;
}

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// A clock that ticks every 30 s, for "last seen" and day separators. Shared by every subscriber.
let current = 0;
const listeners = new Set<() => void>();
let timer: number | null = null;

function subscribe(fn: () => void) {
  listeners.add(fn);
  timer ??= window.setInterval(() => {
    current = Date.now();
    for (const l of listeners) l();
  }, 30_000);
  return () => {
    listeners.delete(fn);
    if (!listeners.size && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

function snapshot() {
  if (!current) current = Date.now();
  return current;
}

export function useNow() {
  return useSyncExternalStore(subscribe, snapshot, () => 0);
}

/** For lists: the time today, "Yesterday", or the date. */
export function listTime(iso: string, now: number) {
  const label = dayLabel(iso, now);
  if (label === "Today") return timeOf(iso);
  if (label === "Yesterday") return label;
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" }).format(new Date(iso));
}
