"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDownIcon } from "@phosphor-icons/react";
import { AlertDialog } from "radix-ui";
import { dayKey, dayLabel, useNow } from "@/components/chat/format";
import { ImageViewer, type ViewerImage } from "@/components/chat/image-viewer";
import { MessageBubble, type BubbleHandlers } from "@/components/chat/message-bubble";
import type { ChatMessage, ChatController } from "@/components/chat/use-chat";
import type { ChatSide } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

const NEAR_BOTTOM = 80;

type Props = {
  chat: ChatController;
  viewer: ChatSide;
  canModerate: boolean;
  nameFor: (sender: ChatMessage["sender"]) => string;
  onReply: (m: ChatMessage) => void;
  onEdit: (m: ChatMessage) => void;
  /** After the customer answers an invoice question (the panel focuses the message box on "disputed"). */
  onAnswered?: (answer: "confirmed" | "disputed") => void;
  empty?: React.ReactNode;
  /** Shown right after one message (the customer's notifications card, after the thanks for confirming an invoice). */
  after?: { id: string; node: React.ReactNode } | null;
};

const fromOtherSide = (m: ChatMessage, viewer: ChatSide) => (viewer === "customer" ? m.sender !== "customer" : m.sender === "customer");

export function MessageList({ chat, viewer, canModerate, nameFor, onReply, onEdit, onAnswered, empty, after }: Props) {
  const { messages, status, hasMore, loadOlder, react, retry, discard, remove, answerInvoice } = chat;
  const now = useNow();
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLOListElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const anchor = useRef<{ height: number; top: number } | null>(null);
  const placed = useRef(false);
  const lastMineId = useRef<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [seenUpTo, setSeenUpTo] = useState("");
  const [viewing, setViewing] = useState<ViewerImage | null>(null);
  const [confirming, setConfirming] = useState<ChatMessage | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // Where "Unread messages" goes: the first message from the other side that was unread when the chat opened.
  const [unreadFrom, setUnreadFrom] = useState<string | null | undefined>(undefined);
  if (unreadFrom === undefined && status === "ready") {
    setUnreadFrom(messages.find((m) => fromOtherSide(m, viewer) && !m.readAt && !m.deleted)?.id ?? null);
  }

  const newest = messages.at(-1)?.createdAt ?? "";
  const newCount = useMemo(() => messages.filter((m) => fromOtherSide(m, viewer) && m.createdAt > seenUpTo).length, [messages, viewer, seenUpTo]);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "instant" });
  }, []);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM;
    stick.current = bottom;
    setAtBottom(bottom);
    if (bottom) setSeenUpTo(newest);
  };

  // First paint: open at the unread divider, or at the latest message.
  useLayoutEffect(() => {
    if (status !== "ready" || placed.current || unreadFrom === undefined) return;
    placed.current = true;
    const el = scroller.current;
    const divider = el?.querySelector<HTMLElement>("[data-unread-divider]");
    if (el && divider) {
      el.scrollTop = Math.max(0, divider.offsetTop - 12);
      stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM;
    } else scrollToBottom();
  }, [status, unreadFrom, scrollToBottom]);

  // New messages: keep to the bottom if they were there (or just sent one); keep the place when older ones load above.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (anchor.current) {
      el.scrollTop = anchor.current.top + (el.scrollHeight - anchor.current.height);
      anchor.current = null;
      return;
    }
    const last = messages.at(-1);
    const justSent = last?.mine && last.status === "sending" && last.id !== lastMineId.current;
    if (justSent) lastMineId.current = last.id;
    if (placed.current && (stick.current || justSent)) {
      stick.current = true;
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  // Photos load after layout; stay at the bottom while they do.
  useEffect(() => {
    const el = content.current;
    if (!el) return;
    const observer = new ResizeObserver(() => stick.current && placed.current && scrollToBottom());
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollToBottom]);

  // Older messages when scrolled to the top.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || !scroller.current || !placed.current) return;
        anchor.current = { height: scroller.current.scrollHeight, top: scroller.current.scrollTop };
        void loadOlder().finally(() => {
          // Nothing came back: drop the anchor so the next update scrolls normally.
          window.setTimeout(() => (anchor.current = null), 0);
        });
      },
      { root: scroller.current, rootMargin: "200px 0px 0px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadOlder]);

  const jumpTo = useCallback((id: string) => {
    const target = scroller.current?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(id)}"]`);
    if (!target) return;
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlash(id);
    window.setTimeout(() => setFlash((f) => (f === id ? null : f)), 1400);
  }, []);

  const handlers: BubbleHandlers = useMemo(
    () => ({
      onReply,
      onEdit,
      onDelete: setConfirming,
      onReact: react,
      onRetry: retry,
      onDiscard: discard,
      onOpenImage: setViewing,
      onJumpTo: jumpTo,
      onAnswer: async (invoiceId: string, answer: "confirmed" | "disputed") => {
        // Like sending a message: follow the answer and our reply down (and the notifications card under it).
        stick.current = true;
        scrollToBottom();
        if (await answerInvoice(invoiceId, answer)) onAnswered?.(answer);
      },
    }),
    [onReply, onEdit, react, retry, discard, jumpTo, answerInvoice, onAnswered, scrollToBottom]
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        onScroll={onScroll}
        role="log"
        aria-label="Messages"
        data-lenis-prevent
        // No browser scroll anchoring: its own small corrections fired scroll events that read as the reader
        // leaving the bottom, so new messages stopped being followed. Loading older ones keeps the place itself (anchor).
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain py-3 [overflow-anchor:none]"
      >
        {status === "loading" && (
          <div className="flex flex-col gap-3 px-3" aria-label="Loading messages">
            {[44, 62, 36].map((w, i) => (
              <div key={i} className={cn("h-12 animate-pulse rounded-2xl bg-surface-2", i % 2 ? "self-end" : "self-start")} style={{ width: `${w}%` }} />
            ))}
          </div>
        )}
        {status === "ready" && messages.length === 0 && empty}
        <div ref={sentinel} aria-hidden className="h-px" />
        {hasMore && <p className="pb-2 text-center text-xs text-muted-foreground">Loading earlier messages…</p>}
        <ol ref={content} className="flex flex-col gap-1">
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
            return (
              <Fragment key={m.id}>
                {newDay && now > 0 && (
                  <li className="flex justify-center py-2">
                    <span className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs ring-1 ring-border">
                      {dayLabel(m.createdAt, now)}
                    </span>
                  </li>
                )}
                {m.id === unreadFrom && (
                  <li data-unread-divider className="my-2 flex justify-center bg-primary/10 py-1.5">
                    <span className="text-xs font-medium text-primary-ink">Unread messages</span>
                  </li>
                )}
                <MessageBubble message={m} viewer={viewer} canModerate={canModerate} nameFor={nameFor} highlight={flash === m.id} {...handlers} />
                {after?.id === m.id && after.node}
              </Fragment>
            );
          })}
        </ol>
      </div>

      {!atBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          aria-label={newCount ? `Jump to latest, ${newCount} new` : "Jump to latest"}
          className="absolute right-4 bottom-3 grid size-10 place-items-center rounded-full border border-border bg-popover text-foreground shadow-[0_8px_30px_-8px_var(--shadow-strong)]"
        >
          <ArrowDownIcon className="size-4.5" aria-hidden />
          {newCount > 0 && (
            <span className="absolute -top-1.5 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
              {newCount}
            </span>
          )}
        </button>
      )}

      <AlertDialog.Root open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 z-[60] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-tile)] border border-border bg-popover p-6 shadow-[0_20px_60px_-20px_var(--shadow-strong)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
            <AlertDialog.Title className="font-medium">Delete this message?</AlertDialog.Title>
            <AlertDialog.Description className="mt-1.5 text-sm text-muted-foreground">
              {confirming && !confirming.mine
                ? "It's removed for everyone. The chat shows that a message was deleted."
                : "It's removed for everyone. The chat shows that you deleted a message."}
            </AlertDialog.Description>
            <div className="mt-6 flex justify-end gap-2">
              <AlertDialog.Cancel className="h-10 rounded-full border border-border px-4 text-sm font-medium transition-colors hover:border-foreground/30">
                Cancel
              </AlertDialog.Cancel>
              <AlertDialog.Action
                onClick={() => confirming && remove(confirming.id)}
                className="h-10 rounded-full bg-destructive px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Delete
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      <ImageViewer image={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
