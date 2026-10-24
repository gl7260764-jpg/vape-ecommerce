"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { PREFS, readPref, useAdminChat } from "@/components/admin/chat/admin-chat-store";
import { getPusher, listen } from "@/components/chat/pusher-client";
import { channels, EVENTS } from "@/lib/chat/channels";
import { cn } from "@/lib/utils";

const INBOX_MS = 20_000;
const HEARTBEAT_MS = 25_000;

/** The unread count beside "Chats" in the sidebar. */
export function ChatBadge({ active }: { active: boolean }) {
  const n = useAdminChat((s) => s.unreadTotal);
  if (!n) return null;
  return (
    <span
      data-chat-badge
      aria-label={`${n} unread`}
      className={cn(
        "ml-auto grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
        active ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"
      )}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

/** A short two-note chime, made in the browser (no audio file). */
function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const t = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.16, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    gain.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(1318.5, t + 0.1);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.36);
    osc.onended = () => void ctx.close();
  } catch {
    // Audio blocked until the page is clicked once; the badge and title still show it.
  }
}

const TITLE_PREFIX = /^\(\d+\+?\) /;

/**
 * Mounted once in the admin shell: keeps the inbox fresh, says this team member is online, and
 * alerts when new customer messages arrive (chime, tab title, and a notification while the tab is hidden).
 */
export function ChatWatcher() {
  const router = useRouter();
  const unreadTotal = useAdminChat((s) => s.unreadTotal);
  const loaded = useAdminChat((s) => s.loaded);
  const seen = useRef<number | null>(null);

  useEffect(() => {
    const { load } = useAdminChat.getState();
    void load();
    const timer = window.setInterval(() => void useAdminChat.getState().load(), INBOX_MS);
    const onVisible = () => document.visibilityState === "visible" && void useAdminChat.getState().load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Live inbox: new messages and reads arrive as events; the 20 s poll above covers any gap.
  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    void getPusher("staff").then((pusher) => {
      if (!pusher || cancelled) return;
      stop = listen(pusher, channels.inbox, {
        [EVENTS.inbox]: () => void useAdminChat.getState().load(),
        [EVENTS.badge]: (data) => {
          const n = (data as { unreadTotal?: unknown } | null)?.unreadTotal;
          if (typeof n === "number") useAdminChat.setState({ unreadTotal: n });
          void useAdminChat.getState().load();
        },
      }).stop;
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  // Online while an admin tab is in front.
  useEffect(() => {
    const send = (state: "beat" | "leave") => {
      const body = JSON.stringify({ state });
      if (state === "leave" && navigator.sendBeacon) navigator.sendBeacon("/admin/api/chat/presence", body);
      else void fetch("/admin/api/chat/presence", { method: "POST", body, keepalive: true }).catch(() => {});
    };
    const tick = () => document.visibilityState === "visible" && send("beat");
    tick();
    const timer = window.setInterval(tick, HEARTBEAT_MS);
    const onLeave = () => send("leave");
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("pagehide", onLeave);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("pagehide", onLeave);
    };
  }, []);

  // New messages: chime unless muted, and a notification when the tab is in the background.
  useEffect(() => {
    if (!loaded) return;
    const before = seen.current;
    seen.current = unreadTotal;
    if (before === null || unreadTotal <= before) return;
    if (!readPref(PREFS.muted)) chime();
    if (document.visibilityState === "hidden" && readPref(PREFS.notify) && "Notification" in window && Notification.permission === "granted") {
      const latest = useAdminChat.getState().conversations.find((c) => c.staffUnreadCount > 0);
      const note = new Notification(latest ? latest.customerName : "New chat message", {
        body: latest?.lastMessagePreview ?? "A customer sent a message.",
        tag: "bvsa-chat",
      });
      note.onclick = () => {
        window.focus();
        if (latest) router.push(`/admin/chats/${latest.id}`);
        note.close();
      };
    }
  }, [unreadTotal, loaded, router]);

  // "(3) Chats · Admin" in the tab, kept when Next changes the title on navigation.
  useEffect(() => {
    const apply = () => {
      const base = document.title.replace(TITLE_PREFIX, "");
      const next = unreadTotal ? `(${unreadTotal > 99 ? "99+" : unreadTotal}) ${base}` : base;
      if (document.title !== next) document.title = next;
    };
    apply();
    const head = document.querySelector("head");
    if (!head) return;
    const observer = new MutationObserver(apply);
    observer.observe(head, { subtree: true, childList: true, characterData: true });
    return () => {
      observer.disconnect();
      document.title = document.title.replace(TITLE_PREFIX, "");
    };
  }, [unreadTotal]);

  return null;
}
