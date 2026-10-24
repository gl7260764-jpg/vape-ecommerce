"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeftIcon, InfoIcon } from "@phosphor-icons/react";
import { deleteChatMessage, editStaffMessage, reactStaff, sendStaffMessage, staffReceipts } from "@/app/actions/admin/chat";
import { useAdminChat } from "@/components/admin/chat/admin-chat-store";
import { CustomerAvatar } from "@/components/admin/chat/inbox";
import { Composer } from "@/components/chat/composer";
import { MessageList } from "@/components/chat/message-list";
import { PresenceLine } from "@/components/chat/presence-line";
import { getPusher, listen, pusherConfigured } from "@/components/chat/pusher-client";
import { useChat, type ChatActions, type ChatMessage } from "@/components/chat/use-chat";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { channels, EVENTS } from "@/lib/chat/channels";
import { isOnline } from "@/lib/chat/rules";
import { confirmationState } from "@/lib/invoices/rules";
import type { ConversationDTO } from "@/lib/chat/types";

type Snapshot = { now: string; conversation: ConversationDTO };

const refreshInbox = () => void useAdminChat.getState().load();

/** One conversation for the team: header with presence, the messages, the composer, and the customer's details. */
export function Thread({ conversation, canModerate, details }: { conversation: ConversationDTO; canModerate: boolean; details: ReactNode }) {
  const id = conversation.id;
  const actions = useMemo<ChatActions>(
    () => ({
      send: (input) => sendStaffMessage({ ...input, conversationId: id }),
      edit: editStaffMessage,
      delete: deleteChatMessage,
      react: reactStaff,
      receipts: (input) => staffReceipts({ ...input, conversationId: id }),
    }),
    [id]
  );
  const chat = useChat<Snapshot>({
    side: "staff",
    conversationId: id,
    snapshotUrl: `/admin/api/chat/${id}`,
    uploadUrl: `/admin/api/chat/upload?conversationId=${id}`,
    actions,
    live: pusherConfigured,
    onSent: refreshInbox,
  });

  // The customer coming online or leaving arrives as an inbox event for this conversation.
  const { sync } = chat;
  useEffect(() => {
    if (!pusherConfigured) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    void getPusher("staff").then((pusher) => {
      if (!pusher || cancelled) return;
      stop = listen(pusher, channels.inbox, {
        [EVENTS.inbox]: (data) => (data as { conversationId?: string } | null)?.conversationId === id && void sync(),
      }).stop;
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [id, sync]);
  const current = chat.info?.conversation ?? conversation;
  const lastSeen = current.customerLastSeenAt;
  const online = chat.info ? isOnline(lastSeen ? new Date(lastSeen) : null, "customer", new Date(chat.info.now)) : false;
  const firstName = current.customerName.split(/\s+/)[0] || current.customerName;
  // Where the customer stands with the newest invoice question in this chat.
  const question = chat.messages.findLast((m) => m.sender === "staff" && m.invoice?.latest && m.invoice.askConfirm)?.invoice;
  const state = question ? confirmationState(question, question.status === "payment_due" ? "pending_payment" : question.status) : null;
  const invoiceState =
    state === "confirmed"
      ? { label: "Invoice confirmed", tone: "text-primary-ink bg-primary/12" }
      : state === "disputed"
        ? { label: "Something's wrong", tone: "text-destructive bg-destructive/10" }
        : state === "waiting"
          ? { label: "Not confirmed yet", tone: "text-amber-700 bg-amber-500/12 dark:text-amber-300" }
          : null;

  // Reading here clears this chat's unread count: bring the inbox and the sidebar badge along.
  const unread = current.staffUnreadCount;
  useEffect(() => {
    if (unread === 0) refreshInbox();
  }, [unread]);

  const nameFor = useCallback((sender: ChatMessage["sender"]) => (sender === "customer" ? current.customerName : "Best Vape Shop"), [current.customerName]);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
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

  return (
    <div data-connection={chat.connection} className="fixed inset-x-0 top-14 bottom-0 z-30 flex min-w-0 flex-1 bg-background lg:static lg:z-auto">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-surface px-2 py-2.5 lg:px-4">
          <Link href="/admin/chats" aria-label="Back to chats" className="grid size-10 shrink-0 place-items-center rounded-full text-foreground/80 hover:bg-surface-2 lg:hidden">
            <ArrowLeftIcon className="size-5" aria-hidden />
          </Link>
          <CustomerAvatar name={current.customerName} online={online} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate font-medium">{current.customerName}</h2>
              {invoiceState && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${invoiceState.tone}`}>{invoiceState.label}</span>}
            </div>
            <PresenceLine online={online} lastSeenAt={online ? null : lastSeen} typing={chat.peerTyping} fallback="Not seen on the store yet" />
          </div>
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            aria-label="Customer details"
            className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground 2xl:hidden"
          >
            <InfoIcon className="size-5" aria-hidden />
          </button>
        </header>

        {chat.status === "unavailable" ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">This chat no longer exists.</div>
        ) : (
          <>
            <MessageList chat={chat} viewer="staff" canModerate={canModerate} nameFor={nameFor} onReply={onReply} onEdit={onEdit} />
            <Composer chat={chat} replyTo={replyTo} editing={editing} onCancel={cancel} nameFor={nameFor} placeholder={`Reply to ${firstName}`} />
          </>
        )}
      </div>

      <aside aria-label="Customer details" className="hidden w-[300px] shrink-0 overflow-y-auto border-l border-border bg-surface 2xl:block">
        {details}
      </aside>
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto border-border bg-surface p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-sm 2xl:hidden">
          <SheetTitle className="sr-only">Customer details</SheetTitle>
          <SheetDescription className="sr-only">Orders and contact details for {current.customerName}.</SheetDescription>
          {details}
        </SheetContent>
      </Sheet>
    </div>
  );
}
