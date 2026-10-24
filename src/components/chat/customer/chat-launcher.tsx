"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useChatUi } from "@/components/chat/chat-ui-store";
import { getPusher, listen, peekPusher, pusherConfigured } from "@/components/chat/pusher-client";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useLenisLock } from "@/hooks/use-lenis-lock";
import { channels, EVENTS } from "@/lib/chat/channels";

type Status = { hasConversation: boolean; unread: number; conversationId: string | null };

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
 * The chat on every store page for a device signed into an account: keeps the unread count for the
 * navbar's message icon, opens the chat panel, and tells the team this customer is online.
 */
export function ChatLauncher() {
  const { open, setOpen, pendingOpen, lingering, statusVersion, setStatus: publish } = useChatUi();
  const [status, setStatus] = useState<Status | null>(null);
  const has = Boolean(status?.hasConversation && status.conversationId);
  // Asked to open (the order page) before the chat existed: open as soon as it does.
  const shown = open || (pendingOpen && has);
  useLenisLock(shown);

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
    if (!next) void refresh();
  };

  const unread = shown ? 0 : (status?.unread ?? 0);
  // The navbar's message icon shows these.
  useEffect(() => publish({ signedIn: has, unread }), [has, unread, publish]);

  if (!has) return null;

  return (
    <>
      <Sheet open={shown} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full gap-0 border-border bg-background p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        >
          <SheetTitle className="sr-only">Chat with us</SheetTitle>
          <SheetDescription className="sr-only">Messages with the Best Vape Shop team about your order.</SheetDescription>
          {shown && status?.conversationId && <ChatPanel conversationId={status.conversationId} live={pusherConfigured} />}
        </SheetContent>
      </Sheet>
    </>
  );
}
