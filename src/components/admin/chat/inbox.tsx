"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BellIcon, BellSlashIcon, ChatsCircleIcon, MagnifyingGlassIcon, SpeakerHighIcon, SpeakerSlashIcon } from "@phosphor-icons/react";
import { PREFS, useAdminChat, usePref } from "@/components/admin/chat/admin-chat-store";
import { listTime, useNow } from "@/components/chat/format";
import { isOnline } from "@/lib/chat/rules";
import type { ConversationDTO } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

export function CustomerAvatar({ name, online, size = "md" }: { name: string; online: boolean; size?: "md" | "lg" }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?";
  return (
    <span className={cn("relative grid shrink-0 place-items-center rounded-full bg-surface-2 font-semibold", size === "lg" ? "size-14 text-lg" : "size-10 text-sm")}>
      <span aria-hidden>{initials}</span>
      {online && <span role="img" aria-label="Online" className="absolute right-0 bottom-0 size-3 rounded-full bg-primary-ink ring-2 ring-surface" />}
    </span>
  );
}

const noop = () => () => {};

function NotifyToggle() {
  const [on, setOn] = usePref(PREFS.notify);
  const supported = useSyncExternalStore(
    noop,
    () => "Notification" in window,
    () => false
  );
  if (!supported) return null;
  const toggle = async () => {
    if (on) return setOn(false);
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    setOn(permission === "granted");
  };
  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-pressed={on}
      aria-label={on ? "Turn off desktop notifications" : "Turn on desktop notifications"}
      title={on ? "Desktop notifications on" : "Desktop notifications off"}
      className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
    >
      {on ? <BellIcon weight="fill" className="size-[1.1rem] text-primary-ink" aria-hidden /> : <BellSlashIcon className="size-[1.1rem]" aria-hidden />}
    </button>
  );
}

function SoundToggle() {
  const [muted, setMuted] = usePref(PREFS.muted);
  return (
    <button
      type="button"
      onClick={() => setMuted(!muted)}
      aria-pressed={!muted}
      aria-label={muted ? "Turn on the new message sound" : "Mute the new message sound"}
      title={muted ? "Sound off" : "Sound on"}
      className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
    >
      {muted ? <SpeakerSlashIcon className="size-[1.1rem]" aria-hidden /> : <SpeakerHighIcon className="size-[1.1rem]" aria-hidden />}
    </button>
  );
}

function Row({ c, selected, serverNow }: { c: ConversationDTO; selected: boolean; serverNow: number }) {
  const now = useNow();
  const online = isOnline(c.customerLastSeenAt ? new Date(c.customerLastSeenAt) : null, "customer", new Date(Math.max(serverNow, now)));
  return (
    <li>
      <Link
        href={`/admin/chats/${c.id}`}
        aria-current={selected ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 px-4 py-3 transition-colors outline-none hover:bg-surface-2 focus-visible:bg-surface-2",
          selected && "bg-surface-2"
        )}
      >
        <CustomerAvatar name={c.customerName} online={online} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className={cn("truncate text-sm", c.staffUnreadCount ? "font-semibold" : "font-medium")}>{c.customerName}</p>
            {c.tag && <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary-ink">{c.tag}</span>}
            {now > 0 && (
              <time dateTime={c.lastMessageAt} className={cn("ml-auto shrink-0 text-xs tabular-nums", c.staffUnreadCount ? "text-primary-ink" : "text-muted-foreground")}>
                {listTime(c.lastMessageAt, now)}
              </time>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <p className={cn("min-w-0 flex-1 truncate text-sm", c.staffUnreadCount ? "text-foreground" : "text-muted-foreground")}>{c.lastMessagePreview || "No messages yet"}</p>
            {c.staffUnreadCount > 0 && (
              <span
                aria-label={`${c.staffUnreadCount} unread`}
                className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums"
              >
                {c.staffUnreadCount}
              </span>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}

/** The conversation list: search, all/unread, and one row per customer device. */
export function Inbox({ initial }: { initial: { conversations: ConversationDTO[]; unreadTotal: number; now: string } }) {
  const selected = useParams<{ id?: string }>().id ?? null;
  const store = useAdminChat();
  const conversations = store.loaded ? store.conversations : initial.conversations;
  const unreadTotal = store.loaded ? store.unreadTotal : initial.unreadTotal;
  const serverNow = new Date(store.now ?? initial.now).getTime();
  const [text, setText] = useState(store.q);
  const { setQuery } = store;

  useEffect(() => {
    if (text === useAdminChat.getState().q) return;
    const timer = window.setTimeout(() => setQuery(text), 250);
    return () => window.clearTimeout(timer);
  }, [text, setQuery]);

  return (
    <section
      aria-label="Chats"
      className={cn("flex min-h-0 w-full flex-col bg-surface lg:w-[300px] lg:shrink-0 lg:border-r lg:border-border xl:w-[340px]", selected && "hidden lg:flex")}
    >
      <div className="border-b border-border px-4 pt-4 pb-3">
        <div className="flex items-center gap-1">
          <h1 className="mr-auto font-display text-xl font-extrabold tracking-tight uppercase">Chats</h1>
          <SoundToggle />
          <NotifyToggle />
        </div>
        <label className="mt-3 flex h-10 items-center gap-2 rounded-full bg-surface-2 px-3.5 focus-within:ring-2 focus-within:ring-ring">
          <MagnifyingGlassIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Search chats"
            placeholder="Name, email or order number"
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
        <div className="mt-3 flex gap-1.5" role="group" aria-label="Show">
          {[
            { label: "All", value: false },
            { label: unreadTotal ? `Unread (${unreadTotal})` : "Unread", value: true },
          ].map((f) => (
            <button
              key={f.label}
              type="button"
              aria-pressed={store.unreadOnly === f.value}
              onClick={() => store.setUnreadOnly(f.value)}
              className={cn(
                "h-8 rounded-full px-3.5 text-xs font-medium transition-colors",
                store.unreadOnly === f.value ? "bg-foreground text-background" : "bg-surface-2 text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {conversations.length ? (
        <ul aria-label="Conversations" data-lenis-prevent className="min-h-0 flex-1 divide-y divide-border overflow-y-auto overscroll-contain">
          {conversations.map((c) => (
            <Row key={c.id} c={c} selected={c.id === selected} serverNow={serverNow} />
          ))}
        </ul>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 py-16 text-center">
          <ChatsCircleIcon className="size-9 text-muted-foreground" aria-hidden />
          <p className="font-medium">{store.q || store.unreadOnly ? "No chats match" : "No chats yet"}</p>
          <p className="text-sm text-muted-foreground">
            {store.q || store.unreadOnly ? "Try another name, email or order number." : "A chat starts when a customer places an order."}
          </p>
        </div>
      )}
    </section>
  );
}
