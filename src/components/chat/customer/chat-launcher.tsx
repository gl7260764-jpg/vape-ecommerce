"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ChatCircleDotsIcon } from "@phosphor-icons/react";
import { useChatUi } from "@/components/chat/chat-ui-store";
import { ChatWindow } from "@/components/chat/customer/chat-window";
import { getPusher, listen, peekPusher, pusherConfigured } from "@/components/chat/pusher-client";
import { AGE_CONFIRMED_EVENT, AGE_STORAGE_KEY } from "@/components/site/age-gate";
import { useLenisLock } from "@/hooks/use-lenis-lock";
import { channels, EVENTS } from "@/lib/chat/channels";
import { cn } from "@/lib/utils";

type Status = { hasConversation: boolean; unread: number; conversationId: string | null; email: string | null };

// Once someone has opened the chat on this device, the button stops pulsing.
const SEEN_KEY = "bvsa-chat-seen";
const readFlag = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

// The first-time form downloads when the window opens on a device with no chat yet.
const StartChat = dynamic(() => import("@/components/chat/customer/start-chat").then((m) => m.StartChat), { ssr: false });

// The panel (bubbles, composer, emoji picker) downloads on first open, never for visitors without a chat.
const ChatPanel = dynamic(() => import("@/components/chat/customer/chat-panel").then((m) => m.ChatPanel), {
  ssr: false,
  loading: () => (
    <div className="flex h-full flex-col gap-3 p-4 pt-20" aria-label="Loading chat">
      {[48, 64, 40].map((w, i) => (
        <div key={i} className={i % 2 ? "h-12 animate-pulse self-end rounded-2xl bg-surface-2" : "h-12 animate-pulse self-start rounded-2xl bg-surface-2"} style={{ width: `${w}%` }} />
      ))}
    </div>
  ),
});

const STATUS_MS = 30_000;
const HEARTBEAT_MS = 25_000;

async function fetchStatus(): Promise<Status | null> {
  try {
    const res = await fetch("/api/chat/status", { cache: "no-store" });
    return res.ok ? ((await res.json()) as Status) : null;
  } catch {
    return null;
  }
}

const beat = (state: "beat" | "leave") => {
  const body = JSON.stringify({ state });
  if (state === "leave" && navigator.sendBeacon) navigator.sendBeacon("/api/chat/presence", body);
  else void fetch("/api/chat/presence", { method: "POST", body, keepalive: true }).catch(() => {});
};

/**
 * The live chat on every store page: a floating button for every visitor (after the 18+ check). Its
 * window starts a chat with an email and a first message, or shows this device's conversation. It
 * also keeps the unread count for the navbar's message icon and tells the team the customer is online.
 */
export function ChatLauncher() {
  const { open, setOpen, pendingOpen, lingering, statusVersion, setStatus: publish } = useChatUi();
  const [status, setStatus] = useState<Status | null>(null);
  const has = Boolean(status?.hasConversation && status.conversationId);
  // Asked to open (the order page) before the chat existed: open as soon as it does.
  const shown = open || (pendingOpen && has);
  const [ageOk, setAgeOk] = useState(false);
  const [seen, setSeen] = useState(true);
  const [phone, setPhone] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // On phones the window is the whole screen, so the page behind stops scrolling; on computers it keeps working.
  useLenisLock(shown && phone);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- storage and media queries are only readable after mount
    setAgeOk(readFlag(AGE_STORAGE_KEY) === "yes");
    setSeen(readFlag(SEEN_KEY) === "yes");
    const media = window.matchMedia("(max-width: 639px)");
    setPhone(media.matches);
    const onMedia = () => setPhone(media.matches);
    const onAge = () => setAgeOk(true);
    media.addEventListener("change", onMedia);
    window.addEventListener(AGE_CONFIRMED_EVENT, onAge);
    return () => {
      media.removeEventListener("change", onMedia);
      window.removeEventListener(AGE_CONFIRMED_EVENT, onAge);
    };
  }, []);

  const refresh = useCallback(async () => {
    const next = await fetchStatus();
    if (next) setStatus(next);
  }, []);

  useEffect(() => {
    const load = () => void fetchStatus().then((next) => next && setStatus(next));
    load();
    const timer = window.setInterval(load, STATUS_MS);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Signing in or out on this device: check again now rather than at the next poll.
  useEffect(() => {
    if (!statusVersion) return;
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [statusVersion, refresh]);

  // The chat is opened by the order that creates it, a moment after the confirmation page loads.
  useEffect(() => {
    if (!pendingOpen || has) return;
    let tries = 0;
    const timer = window.setInterval(() => {
      if (++tries > 20) window.clearInterval(timer);
      void refresh();
    }, 1500);
    return () => window.clearInterval(timer);
  }, [pendingOpen, has, refresh]);

  // Online while a store tab is in front; offline straight away when the last page closes.
  useEffect(() => {
    if (!has) return;
    const tick = () => document.visibilityState === "visible" && beat("beat");
    tick();
    const timer = window.setInterval(tick, HEARTBEAT_MS);
    const onLeave = () => beat("leave");
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("pagehide", onLeave);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("pagehide", onLeave);
    };
  }, [has]);

  // Pusher's free plan counts connections: a customer connects only while the chat is open, and for
  // 10 minutes after sending (so a quick reply still lands live, and updates the badge if they closed it).
  const conversationId = status?.conversationId ?? null;
  const wantLive = pusherConfigured && has && (shown || lingering);
  useEffect(() => {
    if (!pusherConfigured || !conversationId) return;
    let cancelled = false;
    let stop: (() => void) | null = null;
    if (!wantLive) {
      void peekPusher("customer").then((pusher) => pusher?.disconnect());
      return;
    }
    void getPusher("customer").then((pusher) => {
      if (!pusher || cancelled) return;
      if (pusher.connection.state !== "connected" && pusher.connection.state !== "connecting") pusher.connect();
      // With the panel closed, a reply just bumps the badge.
      if (!shown) stop = listen(pusher, channels.conversation(conversationId), { [EVENTS.message]: () => void refresh() }).stop;
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [wantLive, shown, conversationId, refresh]);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && !seen) {
      setSeen(true);
      try {
        window.localStorage.setItem(SEEN_KEY, "yes");
      } catch {
        // storage blocked: it pulses again next visit
      }
    }
    if (!next) void refresh();
  };

  const unread = shown ? 0 : (status?.unread ?? 0);
  // The navbar's message icon shows these.
  useEffect(() => publish({ signedIn: has, unread }), [has, unread, publish]);

  if (!ageOk && !shown) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => onOpenChange(!shown)}
        aria-label={unread ? `Chat with us, ${unread} unread` : "Chat with us"}
        aria-expanded={shown}
        className={cn(
          "fixed right-4 bottom-4 z-[var(--z-header)] grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_12px_40px_-12px_var(--shadow-strong)] transition-[transform,bottom] duration-300 hover:scale-105 active:scale-95 sm:right-6 sm:bottom-6",
          // Above the product page's sticky buy bar, and on phones above a card at the bottom (install, notifications).
          "[body:has([data-sticky-bar=shown])_&]:bottom-24 lg:[body:has([data-sticky-bar=shown])_&]:bottom-6",
          "max-sm:[body:has([data-bottom-card])_&]:bottom-36 max-sm:[body:has([data-sticky-bar=shown]):has([data-bottom-card])_&]:bottom-56"
        )}
      >
        {!seen && <span aria-hidden className="absolute inset-0 rounded-full bg-primary/50 motion-safe:animate-ping" />}
        <ChatCircleDotsIcon weight="fill" className="relative size-7" aria-hidden />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 grid h-6 min-w-6 place-items-center rounded-full bg-foreground px-1.5 text-xs font-semibold text-background ring-2 ring-background">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      <ChatWindow open={shown} onOpenChange={onOpenChange} modal={phone} returnFocusTo={buttonRef}>
        {shown && has && status?.conversationId ? (
          <ChatPanel conversationId={status.conversationId} email={status.email} live={pusherConfigured} />
        ) : shown && !pendingOpen ? (
          <StartChat onStarted={() => void refresh()} />
        ) : null}
      </ChatWindow>
    </>
  );
}
