"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChatsCircleIcon } from "@phosphor-icons/react";
import { answerInvoice, customerReceipts, deleteCustomerMessage, editCustomerMessage, reactCustomer, sendCustomerMessage } from "@/app/actions/chat";
import { useChatUi } from "@/components/chat/chat-ui-store";
import { Composer } from "@/components/chat/composer";
import { MessageList } from "@/components/chat/message-list";
import { PresenceLine } from "@/components/chat/presence-line";
import { getPusher, listen } from "@/components/chat/pusher-client";
import { useChat, type ChatActions, type ChatMessage } from "@/components/chat/use-chat";
import { NotifyBanner } from "@/components/chat/customer/notify-banner";
import { NotifyCard } from "@/components/chat/customer/notify-card";
import { channels, EVENTS } from "@/lib/chat/channels";
import { notifyAfter } from "@/lib/invoices/rules";

const ACTIONS: ChatActions = {
  send: sendCustomerMessage,
  edit: editCustomerMessage,
  delete: deleteCustomerMessage,
  react: reactCustomer,
  // Once their reading is saved, the navbar's unread count catches up (even if they closed the chat first).
  receipts: async (input) => {
    const result = await customerReceipts(input);
    if (result.ok && input.kind === "read") useChatUi.getState().reloadStatus();
    return result;
  },
  answerInvoice,
};

type CustomerSnapshot = { store: { online: boolean; lastSeenAt: string | null } };

const nameFor = (sender: ChatMessage["sender"]) => (sender === "customer" ? "You" : "Best Vape Shop");

/** The customer's side of the conversation, inside the chat sheet. */
export function ChatPanel({ conversationId, email, live }: { conversationId: string; email?: string | null; live: boolean }) {
  const markSent = useChatUi((s) => s.markSent);
  const chat = useChat<CustomerSnapshot>({
    side: "customer",
    conversationId,
    snapshotUrl: "/api/chat",
    uploadUrl: "/api/chat/upload",
    actions: ACTIONS,
    live,
    onSent: markSent,
  });
  // The team coming online or leaving: refresh the header straight away instead of on the next sync.
  const { sync } = chat;
  useEffect(() => {
    if (!live) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    void getPusher("customer").then((pusher) => {
      if (pusher && !cancelled) stop = listen(pusher, channels.store, { [EVENTS.presence]: () => void sync() }).stop;
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [live, sync]);

  const [focusKey, setFocusKey] = useState(0);
  const onAnswered = useCallback((answer: "confirmed" | "disputed") => answer === "disputed" && setFocusKey((k) => k + 1), []);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const onReply = useCallback((m: ChatMessage) => {
    setEditing(null);
    setReplyTo(m);
  }, []);
  const onEdit = useCallback((m: ChatMessage) => {
    setReplyTo(null);
    setEditing(m);
  }, []);
  const cancel = useCallback(() => {
    setReplyTo(null);
    setEditing(null);
  }, []);
  // Invoice confirmed, payment details on their way: the card under the thanks asks instead of the banner.
  const notifyAt = useMemo(() => notifyAfter(chat.messages), [chat.messages]);

  return (
    <div data-connection={chat.connection} className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-surface py-3 pr-14 pl-4">
        <span aria-hidden className="relative grid size-10 shrink-0 place-items-center rounded-full bg-primary font-display text-sm font-black text-primary-foreground">
          B
          {chat.info?.store.online && <span className="absolute right-0 bottom-0 size-2.5 rounded-full bg-primary-ink ring-2 ring-surface" />}
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium">Best Vape Shop</p>
          <PresenceLine
            online={chat.info?.store.online ?? false}
            lastSeenAt={chat.info?.store.lastSeenAt ?? null}
            typing={chat.peerTyping}
            fallback="We reply within 5 minutes"
          />
        </div>
      </header>

      {email && <p className="border-b border-border bg-surface/60 px-4 py-1.5 text-center text-xs text-muted-foreground">Chatting as {email}</p>}
      {!notifyAt && <NotifyBanner />}

      {chat.status === "unavailable" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <ChatsCircleIcon className="size-10 text-muted-foreground" aria-hidden />
          <p className="font-medium">This chat isn&apos;t available on this device</p>
          <p className="text-sm text-muted-foreground">Start a new chat from the chat button.</p>
        </div>
      ) : (
        <>
          <MessageList
            chat={chat}
            viewer="customer"
            canModerate={false}
            nameFor={nameFor}
            onReply={onReply}
            onEdit={onEdit}
            onAnswered={onAnswered}
            after={notifyAt ? { id: notifyAt, node: <NotifyCard /> } : null}
            empty={<p className="px-8 py-10 text-center text-sm text-muted-foreground">Say hello. We usually reply within 5 minutes.</p>}
          />
          <Composer chat={chat} replyTo={replyTo} editing={editing} onCancel={cancel} nameFor={nameFor} focusKey={focusKey} />
        </>
      )}
    </div>
  );
}
