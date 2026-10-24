"use client";

import { memo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowBendUpLeftIcon,
  CaretDownIcon,
  CopyIcon,
  FilePdfIcon,
  FileTextIcon,
  PencilSimpleIcon,
  PlusIcon,
  ProhibitIcon,
  ReceiptIcon,
  TrashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { DropdownMenu } from "radix-ui";
import { EmojiPopover } from "@/components/chat/emoji-picker";
import { InvoiceDocument } from "@/components/invoice/invoice-document";
import { fileSize, timeOf } from "@/components/chat/format";
import { Ticks } from "@/components/chat/ticks";
import type { ChatMessage } from "@/components/chat/use-chat";
import { formatPrice } from "@/lib/catalog";
import { QUICK_REACTIONS } from "@/lib/chat/rules";
import type { ChatInvoiceDTO, ChatSide } from "@/lib/chat/types";
import { canAnswerInvoice, INVOICE_COPY } from "@/lib/invoices/rules";
import { orderNumber, paymentLabel } from "@/lib/checkout";
import { cn } from "@/lib/utils";

export type BubbleHandlers = {
  onReply: (m: ChatMessage) => void;
  onEdit: (m: ChatMessage) => void;
  onDelete: (m: ChatMessage) => void;
  onReact: (id: string, emoji: string | null) => void;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
  onOpenImage: (image: { url: string; name: string }) => void;
  onJumpTo: (id: string) => void;
  /** "Yes, all correct" / "Something's wrong" under an invoice. Resolves once the answer is in. */
  onAnswer: (invoiceId: string, answer: "confirmed" | "disputed") => Promise<unknown>;
};

type Props = BubbleHandlers & {
  message: ChatMessage;
  viewer: ChatSide;
  canModerate: boolean;
  /** Briefly marked after jumping to it from a reply quote. */
  highlight?: boolean;
  /** How to name each sender in reply quotes: "You", "Best Vape Shop", the customer's name. */
  nameFor: (sender: ChatMessage["sender"]) => string;
};

const URL_RE = /\bhttps?:\/\/[^\s<]+[^\s<.,:;"')\]!?]/gi;

/** Links become links; everything else stays plain text (React escapes it). */
function linkify(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const at = match.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    out.push(
      <a key={at} href={match[0]} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-current/40 underline-offset-2 hover:decoration-current">
        {match[0]}
      </a>
    );
    last = at + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** One to three emoji and nothing else: shown large, without a bubble, like on a phone. */
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}(?:️|‍|\p{Emoji_Modifier}|\p{Extended_Pictographic})*\s*){1,3}$/u;

export function canEditMessage(m: ChatMessage) {
  return m.mine && !m.status && !m.deleted && !m.attachment && m.sender !== "system";
}

export function canDeleteMessage(m: ChatMessage, viewer: ChatSide, canModerate: boolean) {
  if (m.status || m.deleted || m.sender === "system") return false;
  return m.mine || (viewer === "staff" && canModerate);
}

/**
 * Which side a message sits on. The customer sees their own messages on the right. In the admin,
 * everything the store sends (the team, automatic messages, invoices) is on the right, like your own
 * side of a WhatsApp chat, and the customer is on the left.
 */
export const onRight = (m: ChatMessage, viewer: ChatSide) => (viewer === "staff" ? m.sender !== "customer" : m.mine);

function OrderCard({ message, viewer }: { message: ChatMessage; viewer: ChatSide }) {
  const order = message.order!;
  return (
    <li data-message-id={message.id} className={cn("flex px-3 py-1", viewer === "staff" ? "justify-end" : "justify-center")}>
      <div className="w-full max-w-sm rounded-[var(--radius-tile)] border border-border bg-surface p-4">
        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <ReceiptIcon className="size-4" aria-hidden /> Order placed · {timeOf(message.createdAt)}
        </p>
        <p className="mt-1.5 font-mono text-lg font-medium">{orderNumber(order.number)}</p>
        <p className="text-sm text-muted-foreground">
          {formatPrice(order.totalCents / 100)} · {paymentLabel(order.paymentMethod)}
        </p>
        {order.link && (
          <Link
            href={order.link}
            className="mt-3 inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-medium transition-colors hover:border-foreground/30"
          >
            View order
          </Link>
        )}
      </div>
    </li>
  );
}

/** An invoice in the chat: the compact invoice and a link to the full, printable one. */
function InvoiceMessage({ message, viewer }: { message: ChatMessage; viewer: ChatSide }) {
  const invoice = message.invoice!;
  return (
    <li data-message-id={message.id} className={cn("flex flex-col px-3 py-1.5", viewer === "staff" ? "items-end" : "items-center")}>
      <div className="w-full max-w-[26rem]">
        <InvoiceDocument snapshot={invoice.snapshot} status={invoice.status} layout="compact" />
        <a
          href={invoice.link}
          target="_blank"
          rel="noopener"
          className="mt-2 flex h-9 items-center justify-center gap-2 rounded-full border border-border bg-surface text-xs font-semibold transition-colors hover:border-foreground/30"
        >
          <FileTextIcon className="size-4" aria-hidden />
          {INVOICE_COPY.openFull}
        </a>
        <p className="mt-1 text-center text-[11px] text-muted-foreground">{timeOf(message.createdAt)}</p>
      </div>
    </li>
  );
}

/** Under the "is everything correct?" question: the two buttons for the customer, or where things stand. */
function InvoiceQuestion({ invoice, viewer, onAnswer }: { invoice: ChatInvoiceDTO; viewer: ChatSide; onAnswer: BubbleHandlers["onAnswer"] }) {
  const [pending, setPending] = useState<"confirmed" | "disputed" | null>(null);
  if (!invoice.latest) return <p className="mt-1.5 text-xs text-muted-foreground">This invoice was replaced by a newer one.</p>;
  if (invoice.answer) {
    const yes = invoice.answer === "confirmed";
    const text = viewer === "customer" ? (yes ? "You confirmed this invoice" : "You said something's wrong") : yes ? "Confirmed by the customer" : "The customer says something's wrong";
    return <p className={cn("mt-1.5 text-xs font-medium", yes ? "text-primary-ink" : "text-muted-foreground")}>{text}</p>;
  }
  // Asked earlier, never answered, and the order has moved on (paid or cancelled): nothing to confirm now.
  if (!canAnswerInvoice(invoice)) return null;
  if (viewer === "staff") return <p className="mt-1.5 text-xs font-medium text-muted-foreground">Not confirmed yet</p>;
  const answer = async (value: "confirmed" | "disputed") => {
    setPending(value);
    try {
      await onAnswer(invoice.id, value);
    } finally {
      setPending(null);
    }
  };
  return (
    <div className="mt-2.5 flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pending !== null}
        onClick={() => void answer("confirmed")}
        className="h-9 flex-1 rounded-full bg-primary px-4 text-sm font-semibold whitespace-nowrap text-primary-foreground transition-[transform,opacity] active:scale-[0.98] disabled:opacity-60"
      >
        {INVOICE_COPY.yesButton}
      </button>
      <button
        type="button"
        disabled={pending !== null}
        onClick={() => void answer("disputed")}
        className="h-9 flex-1 rounded-full border border-foreground/20 px-4 text-sm font-semibold whitespace-nowrap transition-colors hover:border-foreground/40 disabled:opacity-60"
      >
        {INVOICE_COPY.noButton}
      </button>
    </div>
  );
}

function MessageBubbleImpl({ message: m, viewer, canModerate, nameFor, highlight = false, ...on }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const press = useRef<number | null>(null);
  // Reply and Edit move focus to the composer; everything else returns it to the menu button.
  const focusComposer = useRef(false);

  if (m.sender === "system" && m.invoice) return <InvoiceMessage message={m} viewer={viewer} />;
  if (m.sender === "system" && m.order) return <OrderCard message={m} viewer={viewer} />;

  // "mine" here means "on my side": also the store's automatic messages and colleagues' replies in the admin.
  const mine = onRight(m, viewer);
  const big = !m.deleted && !m.attachment && !m.replyTo && EMOJI_ONLY.test(m.body.trim());
  const myReaction = m.reactions.find((r) => r.by === viewer)?.emoji ?? null;
  const editable = canEditMessage(m);
  const deletable = canDeleteMessage(m, viewer, canModerate);
  const hasMenu = !m.deleted && !m.status && m.sender !== "system";

  const cancelPress = () => {
    if (press.current !== null) window.clearTimeout(press.current);
    press.current = null;
  };

  const meta = (
    <span className={cn("ml-auto flex shrink-0 items-center gap-1 pl-2 text-[11px] leading-none text-muted-foreground tabular-nums", !big && "translate-y-0.5")}>
      {m.staffName && viewer === "staff" && (
        <span className="mr-1 truncate">{m.staffName === "Automatic message" ? m.staffName : `Sent by ${m.staffName}`}</span>
      )}
      {m.edited && !m.deleted && <span>Edited</span>}
      <time dateTime={m.createdAt}>{timeOf(m.createdAt)}</time>
      {mine && !m.deleted && <Ticks message={m} />}
    </span>
  );

  return (
    <li
      data-message-id={m.id}
      data-status={m.status ?? "saved"}
      className={cn("group/msg flex flex-col px-3 py-0.5", mine ? "items-end" : "items-start", m.reactions.length > 0 && "mb-3")}
    >
      <EmojiPopover
        anchorOnly
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        closeOnPick
        side="top"
        align={mine ? "end" : "start"}
        onPick={(emoji) => on.onReact(m.id, emoji === myReaction ? null : emoji)}
      >
        <div
          className={cn(
            "relative max-w-[min(85%,28rem)] min-w-0 transition-shadow duration-300 [-webkit-touch-callout:none] pointer-coarse:select-none",
            highlight && "ring-2 ring-primary-ink/60",
            big ? "px-1" : cn("rounded-2xl px-3 pt-1.5 pb-2 shadow-[0_1px_0_var(--border)]", mine ? "rounded-br-md bg-bubble-mine" : "rounded-bl-md bg-surface-2")
          )}
          onContextMenu={(e) => {
            if (!hasMenu) return;
            e.preventDefault();
            setMenuOpen(true);
          }}
          onPointerDown={(e) => {
            if (e.pointerType !== "touch" || !hasMenu) return;
            cancelPress();
            press.current = window.setTimeout(() => {
              setMenuOpen(true);
              navigator.vibrate?.(8);
            }, 450);
          }}
          onPointerUp={cancelPress}
          onPointerCancel={cancelPress}
          onPointerMove={(e) => (Math.abs(e.movementX) + Math.abs(e.movementY) > 6 ? cancelPress() : undefined)}
        >
          {hasMenu && (
            <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
              <DropdownMenu.Trigger
                aria-label="Message options"
                className={cn(
                  "absolute top-1 right-1 z-10 grid size-6 place-items-center rounded-full bg-inherit text-muted-foreground opacity-0 transition-opacity outline-none",
                  "group-hover/msg:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:opacity-100",
                  "pointer-coarse:pointer-events-none",
                  big && "-top-1 -right-1 bg-surface-2"
                )}
              >
                <CaretDownIcon weight="bold" className="size-3.5" aria-hidden />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align={mine ? "end" : "start"}
                  sideOffset={6}
                  collisionPadding={12}
                  onCloseAutoFocus={(e) => {
                    if (focusComposer.current) e.preventDefault();
                    focusComposer.current = false;
                  }}
                  className="z-[60] min-w-52 overflow-hidden rounded-2xl border border-border bg-popover p-1.5 text-sm shadow-[0_20px_60px_-20px_var(--shadow-strong)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
                >
                  <div className="mb-1 flex items-center gap-0.5 border-b border-border px-0.5 pb-1.5">
                    {QUICK_REACTIONS.map((emoji) => (
                      <DropdownMenu.Item
                        key={emoji}
                        aria-label={`React ${emoji}`}
                        onSelect={() => on.onReact(m.id, emoji === myReaction ? null : emoji)}
                        className={cn(
                          "grid size-9 cursor-pointer place-items-center rounded-full text-xl outline-none select-none data-highlighted:bg-surface-2",
                          emoji === myReaction && "bg-surface-2 ring-1 ring-border"
                        )}
                      >
                        {emoji}
                      </DropdownMenu.Item>
                    ))}
                    <DropdownMenu.Item
                      aria-label="More reactions"
                      onSelect={() => setPickerOpen(true)}
                      className="grid size-9 cursor-pointer place-items-center rounded-full text-muted-foreground outline-none data-highlighted:bg-surface-2"
                    >
                      <PlusIcon weight="bold" className="size-4" aria-hidden />
                    </DropdownMenu.Item>
                  </div>
                  <MenuItem
                    icon={ArrowBendUpLeftIcon}
                    onSelect={() => {
                      focusComposer.current = true;
                      on.onReply(m);
                    }}
                  >
                    Reply
                  </MenuItem>
                  {m.body && (
                    <MenuItem icon={CopyIcon} onSelect={() => void navigator.clipboard?.writeText(m.body)}>
                      Copy
                    </MenuItem>
                  )}
                  {editable && (
                    <MenuItem
                      icon={PencilSimpleIcon}
                      onSelect={() => {
                        focusComposer.current = true;
                        on.onEdit(m);
                      }}
                    >
                      Edit
                    </MenuItem>
                  )}
                  {deletable && (
                    <MenuItem icon={TrashIcon} onSelect={() => on.onDelete(m)} danger>
                      Delete
                    </MenuItem>
                  )}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}

          {m.deleted ? (
            <div className="flex flex-wrap items-end gap-x-2">
              <p className="flex items-center gap-1.5 text-[15px] text-muted-foreground italic">
                <ProhibitIcon className="size-4 shrink-0" aria-hidden />
                {m.deletedBySelf ? "You deleted this message" : "This message was deleted"}
              </p>
              {meta}
            </div>
          ) : (
            <>
              {m.replyTo && (
                <button
                  type="button"
                  onClick={() => on.onJumpTo(m.replyTo!.id)}
                  className="mt-0.5 mb-1 block w-full min-w-0 rounded-lg border-l-[3px] border-primary-ink bg-foreground/[0.06] px-2.5 py-1.5 text-left"
                >
                  <span className="block text-xs font-semibold text-primary-ink">{nameFor(m.replyTo.sender as ChatMessage["sender"])}</span>
                  <span className="line-clamp-2 text-[13px] [overflow-wrap:anywhere] text-muted-foreground">{m.replyTo.preview}</span>
                </button>
              )}

              {m.attachment?.kind === "image" && (
                <button
                  type="button"
                  aria-label="Open photo"
                  disabled={!m.attachment.url}
                  onClick={() => on.onOpenImage({ url: m.attachment!.url, name: m.attachment!.name })}
                  className="relative -mx-1.5 mt-0.5 mb-1 block w-[min(16rem,calc(100vw-7rem))] overflow-hidden rounded-xl bg-foreground/5"
                  style={{ aspectRatio: m.attachment.width && m.attachment.height ? `${m.attachment.width} / ${m.attachment.height}` : "4 / 3" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- private, access-checked file; the image optimiser can't fetch it */}
                  <img src={m.attachment.url} alt={m.attachment.name} loading="lazy" className="size-full max-h-80 object-cover" />
                  {m.status === "sending" && (
                    <span className="absolute inset-0 grid place-items-center bg-black/25">
                      <span className="size-8 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
                    </span>
                  )}
                </button>
              )}

              {m.attachment?.kind === "file" &&
                (() => {
                  const inner = (
                    <>
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-destructive/12 text-destructive">
                        <FilePdfIcon weight="fill" className="size-5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{m.attachment!.name}</span>
                        <span className="block text-xs text-muted-foreground">PDF · {fileSize(m.attachment!.size)}</span>
                      </span>
                    </>
                  );
                  const cls = "-mx-1.5 mt-0.5 mb-1 flex w-[min(16rem,calc(100vw-7rem))] items-center gap-3 rounded-xl bg-foreground/[0.06] p-2.5";
                  return m.attachment!.url && !m.status ? (
                    <a href={m.attachment!.url} target="_blank" rel="noopener noreferrer" className={cn(cls, "transition-colors hover:bg-foreground/10")}>
                      {inner}
                    </a>
                  ) : (
                    <div className={cls}>{inner}</div>
                  );
                })()}

              <div className="flex flex-wrap items-end gap-x-2">
                {m.body && (
                  <p className={cn("min-w-0 flex-auto whitespace-pre-wrap [overflow-wrap:anywhere]", big ? "text-[2.6rem] leading-tight" : "text-[15px] leading-snug", hasMenu && !big && "pr-4")}>
                    {big ? m.body : linkify(m.body)}
                  </p>
                )}
                {meta}
              </div>
              {m.invoice && m.sender === "staff" && <InvoiceQuestion invoice={m.invoice} viewer={viewer} onAnswer={on.onAnswer} />}
            </>
          )}

          {m.reactions.length > 0 && (
            <button
              type="button"
              onClick={() => myReaction && on.onReact(m.id, null)}
              aria-label={`Reactions: ${m.reactions.map((r) => r.emoji).join(" ")}${myReaction ? ". Tap to remove yours" : ""}`}
              className={cn(
                "absolute -bottom-3.5 flex h-6 items-center gap-0.5 rounded-full border border-border bg-popover px-1.5 text-sm shadow-xs",
                mine ? "right-2" : "left-2"
              )}
            >
              {m.reactions.map((r) => (
                <span key={r.by}>{r.emoji}</span>
              ))}
            </button>
          )}
        </div>
      </EmojiPopover>

      {m.status === "failed" && (
        <div className="mt-1 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs">
          <button type="button" onClick={() => on.onRetry(m.id)} className="inline-flex items-center gap-1 font-medium text-destructive">
            <WarningCircleIcon weight="fill" className="size-4" aria-hidden />
            Not sent. Tap to retry
          </button>
          {m.error && m.error !== "No connection." && <span className="text-muted-foreground">{m.error}</span>}
          <button type="button" onClick={() => on.onDiscard(m.id)} className="text-muted-foreground underline-offset-2 hover:underline">
            Remove
          </button>
        </div>
      )}
    </li>
  );
}

function MenuItem({ icon: Icon, children, onSelect, danger }: { icon: typeof CopyIcon; children: ReactNode; onSelect: () => void; danger?: boolean }) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex h-10 cursor-pointer items-center gap-3 rounded-xl px-3 outline-none select-none data-highlighted:bg-surface-2",
        danger && "text-destructive"
      )}
    >
      <Icon className="size-4.5" aria-hidden />
      {children}
    </DropdownMenu.Item>
  );
}

export const MessageBubble = memo(MessageBubbleImpl);
