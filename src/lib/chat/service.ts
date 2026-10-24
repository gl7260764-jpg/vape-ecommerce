import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { attachmentKind, canDelete, canEdit, CHAT_FILE_KEY, MAX_BODY, previewText, RATE_PER_MINUTE, type Actor, type MessageFacts } from "@/lib/chat/rules";
import { channels, EVENTS, getPusherServer, publish } from "@/lib/chat/realtime";
import type { ChatMessageDTO, ChatSide, StoredAttachment } from "@/lib/chat/types";
import { orderNumber } from "@/lib/checkout";
import { INVOICE_COPY, invoiceStatus } from "@/lib/invoices/rules";
import { buildSnapshot, createInvoice } from "@/lib/invoices/service";
import type { InvoiceSnapshot } from "@/lib/invoices/types";

// The one place chat data is written. Customer and admin actions both call these, passing who is
// acting; every rule is checked here, whatever the UI offered.

export type ChatErrorCode = "FORBIDDEN" | "NOT_FOUND" | "TOO_LONG" | "EMPTY" | "RATE_LIMITED" | "INVALID";

export class ChatError extends Error {
  constructor(readonly code: ChatErrorCode) {
    super(code);
    this.name = "ChatError";
  }
}

/** What each error means to the person using the chat. */
export function chatErrorMessage(code: ChatErrorCode): string {
  return {
    FORBIDDEN: "You can't change that message.",
    NOT_FOUND: "That message is no longer there.",
    TOO_LONG: "Messages can be up to 4,000 characters.",
    EMPTY: "Type a message first.",
    RATE_LIMITED: "You're sending messages very fast. Wait a moment, then try again.",
    INVALID: "That didn't work. Please try again.",
  }[code];
}

export const WELCOME_TEXT = "Thanks! We'll send your payment details here within 5 minutes.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMOJI = /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|‍|️){1,12}$/u;

const messageSelect = {
  id: true,
  conversationId: true,
  sender: true,
  staffId: true,
  body: true,
  attachmentKey: true,
  attachmentName: true,
  attachmentMime: true,
  attachmentSize: true,
  attachmentWidth: true,
  attachmentHeight: true,
  orderId: true,
  editedAt: true,
  deletedAt: true,
  deletedBy: true,
  deliveredAt: true,
  readAt: true,
  createdAt: true,
  updatedAt: true,
  staff: { select: { name: true } },
  replyTo: { select: { id: true, sender: true, body: true, deletedAt: true, attachmentMime: true, attachmentName: true } },
  order: { select: { id: true, number: true, totalCents: true, paymentMethod: true, status: true, publicToken: true } },
  invoice: {
    select: {
      id: true,
      number: true,
      version: true,
      snapshot: true,
      askConfirm: true,
      answer: true,
      order: { select: { id: true, status: true, publicToken: true, invoices: { orderBy: { version: "desc" }, take: 1, select: { version: true } } } },
    },
  },
  reactions: { select: { by: true, emoji: true }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.ChatMessageSelect;

type MessageRow = Prisma.ChatMessageGetPayload<{ select: typeof messageSelect }>;

const deletedByOf = (a: Actor) => (a.kind === "customer" ? "customer" : `staff:${a.adminId}`);

const factsOf = (m: Pick<MessageRow, "sender" | "staffId" | "conversationId" | "createdAt" | "deletedAt" | "attachmentKey">): MessageFacts => ({
  sender: m.sender,
  staffId: m.staffId,
  conversationId: m.conversationId,
  createdAt: m.createdAt,
  deletedAt: m.deletedAt,
  hasAttachment: Boolean(m.attachmentKey),
});

/** What one viewer may see of a message: no staff names for customers, no content once deleted. */
export function toDTO(m: MessageRow, viewer: Actor): ChatMessageDTO {
  const deleted = Boolean(m.deletedAt);
  const kind = m.attachmentMime ? attachmentKind(m.attachmentMime) : null;
  const fileBase = viewer.kind === "customer" ? "/api/chat/files/" : "/admin/api/chat/files/";
  const mine = viewer.kind === "customer" ? m.sender === "customer" : m.sender === "staff" && m.staffId === viewer.adminId;
  return {
    id: m.id,
    sender: m.sender,
    mine,
    staffName: viewer.kind === "staff" && m.sender === "staff" ? (m.staff?.name ?? "Automatic message") : null,
    body: deleted ? "" : m.body,
    attachment:
      !deleted && m.attachmentKey && kind
        ? {
            url: fileBase + m.attachmentKey,
            name: m.attachmentName ?? "file",
            mime: m.attachmentMime!,
            size: m.attachmentSize ?? 0,
            width: m.attachmentWidth,
            height: m.attachmentHeight,
            kind,
          }
        : null,
    replyTo: m.replyTo
      ? {
          id: m.replyTo.id,
          sender: m.replyTo.sender,
          preview: previewText({
            body: m.replyTo.body,
            deletedAt: m.replyTo.deletedAt,
            attachmentKind: m.replyTo.attachmentMime ? attachmentKind(m.replyTo.attachmentMime) : null,
            attachmentName: m.replyTo.attachmentName,
          }),
        }
      : null,
    order: m.order
      ? {
          id: m.order.id,
          number: m.order.number,
          totalCents: m.order.totalCents,
          paymentMethod: m.order.paymentMethod,
          status: m.order.status,
          link: viewer.kind === "customer" ? `/order/${m.order.publicToken}` : null,
        }
      : null,
    invoice: m.invoice
      ? (() => {
          const latest = m.invoice.order.invoices[0]?.version === m.invoice.version;
          return {
            id: m.invoice.id,
            number: m.invoice.number,
            version: m.invoice.version,
            snapshot: m.invoice.snapshot as InvoiceSnapshot,
            status: invoiceStatus(m.invoice.order.status, latest),
            askConfirm: m.invoice.askConfirm,
            answer: m.invoice.answer,
            latest,
            link:
              viewer.kind === "customer"
                ? `/invoice/${m.invoice.order.publicToken}?v=${m.invoice.version}`
                : `/admin/invoice/${m.invoice.order.id}/${m.invoice.version}`,
          };
        })()
      : null,
    edited: Boolean(m.editedAt) && !deleted,
    deleted,
    deletedBySelf: deleted && m.deletedBy === deletedByOf(viewer),
    deliveredAt: m.deliveredAt?.toISOString() ?? null,
    readAt: m.readAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    reactions: m.reactions.map((r) => ({ by: r.by as ChatSide, emoji: r.emoji })),
  };
}

/** Customers only ever touch their own conversation. Throws if the conversation doesn't exist. */
async function assertAccess(actor: Actor, conversationId: string) {
  if (actor.kind === "customer" && actor.conversationId !== conversationId) throw new ChatError("FORBIDDEN");
  const exists = await prisma.chatConversation.count({ where: { id: conversationId } });
  if (!exists) throw new ChatError("NOT_FOUND");
}

async function findMessage(id: string) {
  if (!UUID.test(id)) throw new ChatError("NOT_FOUND");
  const m = await prisma.chatMessage.findUnique({ where: { id }, select: messageSelect });
  if (!m) throw new ChatError("NOT_FOUND");
  return m;
}

/** Tells listening browsers to sync. The payload is only an id: content travels by the access-checked sync. */
/** Tells the team's inbox about a new or changed conversation (a new account's chat, for one). */
export async function announceInbox(conversationId: string): Promise<void> {
  await announce(conversationId, EVENTS.message, { inbox: true });
}

async function announce(conversationId: string, event: string, opts: { inbox?: boolean } = {}) {
  if (!getPusherServer()) return; // polling clients pick changes up on their own
  const jobs = [publish(channels.conversation(conversationId), event, { conversationId })];
  if (opts.inbox) {
    jobs.push(publish(channels.inbox, EVENTS.inbox, { conversationId }));
    jobs.push(
      prisma.chatConversation
        .aggregate({ _sum: { staffUnreadCount: true } })
        .then((r) => publish(channels.inbox, EVENTS.badge, { unreadTotal: r._sum.staffUnreadCount ?? 0 }))
        .catch((error) => console.error("chat badge total failed", error))
    );
  }
  await Promise.all(jobs);
}

/** Keeps the inbox preview right after the latest message is edited or deleted. */
async function refreshPreview(conversationId: string) {
  const latest = await prisma.chatMessage.findFirst({
    where: { conversationId, sender: { not: "system" } },
    orderBy: { createdAt: "desc" },
    select: { body: true, deletedAt: true, attachmentMime: true, attachmentName: true },
  });
  if (!latest) return;
  await prisma.chatConversation.update({
    where: { id: conversationId },
    data: {
      lastMessagePreview: previewText({
        body: latest.body,
        deletedAt: latest.deletedAt,
        attachmentKind: latest.attachmentMime ? attachmentKind(latest.attachmentMime) : null,
        attachmentName: latest.attachmentName,
      }),
    },
  });
}

const cleanBody = (body: string) => body.replace(/\r\n?/g, "\n").trim();

export async function sendMessage(
  actor: Actor,
  input: { id: string; conversationId: string; body: string; replyToId?: string | null; attachment?: StoredAttachment | null }
): Promise<ChatMessageDTO> {
  if (!UUID.test(input.id)) throw new ChatError("INVALID");
  const body = cleanBody(input.body ?? "");
  if (body.length > MAX_BODY) throw new ChatError("TOO_LONG");
  if (!body && !input.attachment) throw new ChatError("EMPTY");
  if (actor.kind === "customer" && actor.conversationId !== input.conversationId) throw new ChatError("FORBIDDEN");

  // Resending the same id (a retry, or a second tab) returns the message already saved.
  const existing = await prisma.chatMessage.findUnique({ where: { id: input.id }, select: messageSelect });
  if (existing) {
    const sameSender = existing.sender === actor.kind && (actor.kind === "customer" || existing.staffId === actor.adminId);
    if (existing.conversationId !== input.conversationId || !sameSender) throw new ChatError("FORBIDDEN");
    return toDTO(existing, actor);
  }

  await assertAccess(actor, input.conversationId);
  const recent = await prisma.chatMessage.count({
    where: { conversationId: input.conversationId, sender: actor.kind, createdAt: { gt: new Date(Date.now() - 60_000) } },
  });
  if (recent >= RATE_PER_MINUTE[actor.kind]) throw new ChatError("RATE_LIMITED");

  const attachment = input.attachment ?? null;
  // Only keys the upload step wrote into this conversation's folder, and the type has to match how it was stored.
  if (attachment) {
    const [, folder, ext] = CHAT_FILE_KEY.exec(attachment.key) ?? [];
    const typeMatches = (attachment.mime === "image/webp" && ext === "webp") || (attachment.mime === "application/pdf" && ext === "pdf");
    if (folder !== input.conversationId || !typeMatches) throw new ChatError("FORBIDDEN");
  }
  const replyToId = input.replyToId
    ? ((await prisma.chatMessage.findFirst({ where: { id: input.replyToId, conversationId: input.conversationId }, select: { id: true } }))?.id ?? null)
    : null;
  const preview = previewText({ body, deletedAt: null, attachmentKind: attachment ? attachmentKind(attachment.mime) : null, attachmentName: attachment?.name ?? null });

  let row: MessageRow;
  try {
    [row] = await prisma.$transaction([
      prisma.chatMessage.create({
        data: {
          id: input.id,
          conversationId: input.conversationId,
          sender: actor.kind,
          staffId: actor.kind === "staff" ? actor.adminId : null,
          body,
          attachmentKey: attachment?.key,
          attachmentName: attachment?.name,
          attachmentMime: attachment?.mime,
          attachmentSize: attachment?.size,
          attachmentWidth: attachment?.width,
          attachmentHeight: attachment?.height,
          replyToId,
        },
        select: messageSelect,
      }),
      prisma.chatConversation.update({
        where: { id: input.conversationId },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: preview,
          ...(actor.kind === "customer" ? { staffUnreadCount: { increment: 1 } } : { customerUnreadCount: { increment: 1 } }),
        },
      }),
    ]);
  } catch (error) {
    // Two tabs sending the same id at the same moment: the second one gets the first one's row.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return toDTO(await findMessage(input.id), actor);
    throw error;
  }
  await announce(input.conversationId, EVENTS.message, { inbox: true });
  return toDTO(row, actor);
}

export async function editMessage(actor: Actor, input: { id: string; body: string }): Promise<ChatMessageDTO> {
  const body = cleanBody(input.body ?? "");
  if (body.length > MAX_BODY) throw new ChatError("TOO_LONG");
  if (!body) throw new ChatError("EMPTY");
  const m = await findMessage(input.id);
  if (actor.kind === "customer" && actor.conversationId !== m.conversationId) throw new ChatError("FORBIDDEN");
  if (!canEdit(factsOf(m), actor)) throw new ChatError("FORBIDDEN");
  const row = await prisma.chatMessage.update({ where: { id: m.id }, data: { body, editedAt: new Date() }, select: messageSelect });
  await refreshPreview(m.conversationId);
  await announce(m.conversationId, EVENTS.message, { inbox: true });
  return toDTO(row, actor);
}

/** Wipes the content and the file but keeps the row, so the bubble keeps its place. */
export async function deleteMessage(actor: Actor, input: { id: string }): Promise<ChatMessageDTO> {
  const m = await findMessage(input.id);
  if (actor.kind === "customer" && actor.conversationId !== m.conversationId) throw new ChatError("FORBIDDEN");
  if (!canDelete(factsOf(m), actor)) throw new ChatError("FORBIDDEN");
  const [row] = await prisma.$transaction([
    prisma.chatMessage.update({
      where: { id: m.id },
      data: {
        body: "",
        attachmentKey: null,
        attachmentName: null,
        attachmentMime: null,
        attachmentSize: null,
        attachmentWidth: null,
        attachmentHeight: null,
        deletedAt: new Date(),
        deletedBy: deletedByOf(actor),
      },
      select: messageSelect,
    }),
    prisma.chatReaction.deleteMany({ where: { messageId: m.id } }),
  ]);
  // Only ever a file from this conversation's own folder, whatever the row says.
  if (m.attachmentKey && CHAT_FILE_KEY.exec(m.attachmentKey)?.[1] === m.conversationId) {
    // Loaded on demand: the storage SDK is ESM-only and only needed when a file goes.
    const { assets } = await import("@/lib/storage");
    await assets.delete(m.attachmentKey).catch((error: unknown) => console.error("could not delete chat file", error));
  }
  await refreshPreview(m.conversationId);
  await announce(m.conversationId, EVENTS.message, { inbox: true });
  return toDTO(row, actor);
}

/** One reaction per side; null removes it. */
export async function react(actor: Actor, input: { id: string; emoji: string | null }): Promise<void> {
  if (input.emoji !== null && !EMOJI.test(input.emoji)) throw new ChatError("INVALID");
  const m = await findMessage(input.id);
  if (actor.kind === "customer" && actor.conversationId !== m.conversationId) throw new ChatError("FORBIDDEN");
  if (m.deletedAt || m.sender === "system") throw new ChatError("INVALID");
  const where = { messageId_by: { messageId: m.id, by: actor.kind } };
  await prisma.$transaction([
    input.emoji === null
      ? prisma.chatReaction.deleteMany({ where: { messageId: m.id, by: actor.kind } })
      : prisma.chatReaction.upsert({ where, create: { messageId: m.id, by: actor.kind, emoji: input.emoji }, update: { emoji: input.emoji } }),
    // Bump the message so syncs pick the reaction up.
    prisma.chatMessage.update({ where: { id: m.id }, data: { updatedAt: new Date() } }),
  ]);
  await announce(m.conversationId, EVENTS.reaction);
}

/** Delivered/read ticks for the other side's messages up to a point in time. */
export async function markReceipts(actor: Actor, input: { conversationId: string; kind: "delivered" | "read"; upTo: string }): Promise<void> {
  await assertAccess(actor, input.conversationId);
  const upTo = new Date(input.upTo);
  if (Number.isNaN(upTo.getTime())) throw new ChatError("INVALID");
  const now = new Date();
  const cap = upTo > now ? now : upTo;
  const others: ("customer" | "staff" | "system")[] = actor.kind === "customer" ? ["staff", "system"] : ["customer"];
  const scope = { conversationId: input.conversationId, sender: { in: others }, createdAt: { lte: cap } };

  const delivered = await prisma.chatMessage.updateMany({ where: { ...scope, deliveredAt: null }, data: { deliveredAt: now } });
  let read = { count: 0 };
  if (input.kind === "read") {
    read = await prisma.chatMessage.updateMany({ where: { ...scope, readAt: null }, data: { readAt: now } });
    await prisma.chatConversation.update({
      where: { id: input.conversationId },
      data: actor.kind === "customer" ? { customerUnreadCount: 0 } : { staffUnreadCount: 0 },
    });
  }
  if (delivered.count || read.count) {
    await announce(input.conversationId, EVENTS.receipts, { inbox: actor.kind === "staff" && read.count > 0 });
  }
}

/**
 * The team's inbox was fetched: every customer message waiting there is now delivered (two grey ticks),
 * the way a phone gets its ticks once it comes online. Nothing is marked read here.
 */
export async function markAllDelivered(): Promise<number> {
  const waiting = await prisma.chatMessage.findMany({
    where: { sender: "customer", deliveredAt: null },
    distinct: ["conversationId"],
    take: 200,
    select: { conversationId: true },
  });
  if (!waiting.length) return 0;
  const ids = waiting.map((w) => w.conversationId);
  const { count } = await prisma.chatMessage.updateMany({
    where: { sender: "customer", deliveredAt: null, conversationId: { in: ids } },
    data: { deliveredAt: new Date() },
  });
  await Promise.all(ids.map((id) => announce(id, EVENTS.receipts)));
  return count;
}

/** Syncs re-read changes from 10 s before the last sync, so a slow commit is never skipped; clients merge by id. */
const SYNC_OVERLAP_MS = 10_000;

/** Where a `changedSince` sync starts reading. Throws INVALID for a time that doesn't parse. */
export function syncFrom(changedSince: string): string {
  const t = new Date(changedSince).getTime();
  if (Number.isNaN(t)) throw new ChatError("INVALID");
  return new Date(t - SYNC_OVERLAP_MS).toISOString();
}

/**
 * Messages for one viewer. Default: the newest 200. `before`: 50 older ones. `changedSince`: everything
 * created or changed after that server time (new messages, edits, deletes, ticks, reactions).
 */
export async function listMessages(
  conversationId: string,
  viewer: Actor,
  opts: { before?: string; changedSince?: string; limit?: number } = {}
): Promise<ChatMessageDTO[]> {
  await assertAccess(viewer, conversationId);
  const parse = (v: string) => {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) throw new ChatError("INVALID");
    return d;
  };
  if (opts.changedSince) {
    const rows = await prisma.chatMessage.findMany({
      where: { conversationId, updatedAt: { gt: parse(opts.changedSince) } },
      orderBy: { createdAt: "asc" },
      take: 500,
      select: messageSelect,
    });
    return rows.map((r) => toDTO(r, viewer));
  }
  const rows = await prisma.chatMessage.findMany({
    where: { conversationId, ...(opts.before ? { createdAt: { lt: parse(opts.before) } } : {}) },
    orderBy: { createdAt: "desc" },
    take: Math.min(opts.limit ?? (opts.before ? 50 : 200), 200),
    select: messageSelect,
  });
  return rows.reverse().map((r) => toDTO(r, viewer));
}

/**
 * Called when a device places an order: opens (or reuses) that device's conversation, adds the
 * order card and the automatic welcome, and tells the team's inbox.
 */
export async function openOrderConversation(
  tokenHash: string,
  order: { id: string; number: number; totalCents: number; paymentMethod: string; customerId: string | null; fullName: string; email: string }
): Promise<string> {
  // Once per order, even when the checkout hook and the recovery check race each other.
  const card = await prisma.chatMessage.findFirst({ where: { orderId: order.id, sender: "system" }, select: { conversationId: true } });
  if (card) return card.conversationId;

  const conversation = await upsertConversation(tokenHash, order);
  // The chat opens with the order's invoice: the newest one if the team already issued one, otherwise version 1.
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  const [existing, { status }] = await Promise.all([
    prisma.invoice.findFirst({ where: { orderId: order.id }, orderBy: { version: "desc" }, select: { id: true, askConfirm: true, answer: true } }),
    prisma.order.findUniqueOrThrow({ where: { id: order.id }, select: { status: true } }),
  ]);
  let invoice = existing;
  if (!invoice) {
    const snapshot = await buildSnapshot(order.id, 1);
    invoice = { id: randomUUID(), askConfirm: status === "pending_payment", answer: null };
    ops.push(
      prisma.invoice.create({
        data: { id: invoice.id, orderId: order.id, version: 1, number: snapshot.number, snapshot, askConfirm: invoice.askConfirm, sentById: null },
      })
    );
  }
  const at = Date.now();
  ops.push(
    prisma.chatMessage.create({
      data: { id: orderMessageId(order.id, "card"), conversationId: conversation.id, sender: "system", orderId: order.id, invoiceId: invoice.id, createdAt: new Date(at) },
    })
  );
  // Asked only while the order still awaits payment.
  if (invoice.askConfirm && !invoice.answer && status === "pending_payment") {
    ops.push(
      prisma.chatMessage.create({
        data: {
          id: orderMessageId(order.id, "welcome"),
          conversationId: conversation.id,
          sender: "staff",
          staffId: null,
          body: INVOICE_COPY.question,
          invoiceId: invoice.id,
          createdAt: new Date(at + 1),
        },
      })
    );
  }
  // The customer has an invoice to check; the team has a new order.
  ops.push(
    prisma.chatConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(at + 1),
        lastMessagePreview: `New order ${orderNumber(order.number)}`,
        customerUnreadCount: { increment: 1 },
        staffUnreadCount: { increment: 1 },
      },
    })
  );
  try {
    await prisma.$transaction(ops);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return conversation.id; // the other call added it
    throw error;
  }
  await announce(conversation.id, EVENTS.message, { inbox: true });
  return conversation.id;
}

type Db = typeof prisma | Prisma.TransactionClient;

/** The chat of the device that placed the order, if it has one. */
async function conversationForOrder(orderId: string, db: Db = prisma): Promise<string | null> {
  const access = await db.orderAccess.findFirst({ where: { orderId, fullDetails: true }, orderBy: { createdAt: "asc" }, select: { tokenHash: true } });
  if (!access) return null;
  return (await db.chatConversation.findUnique({ where: { deviceTokenHash: access.tokenHash }, select: { id: true } }))?.id ?? null;
}

const TX = { maxWait: 10_000, timeout: 20_000 };

/** Writes an invoice (and, while payment is due, its question) into a chat. Older invoices of the order re-render as REPLACED. */
async function writeInvoiceMessages(
  db: Db,
  invoice: { id: string; number: string; version: number; askConfirm: boolean; orderId: string },
  conversationId: string
) {
  const at = Date.now();
  const status = (await db.order.findUniqueOrThrow({ where: { id: invoice.orderId }, select: { status: true } })).status;
  const ask = invoice.askConfirm && status === "pending_payment";
  const seed = `${invoice.orderId}:v${invoice.version}`;
  await db.chatMessage.create({
    data: { id: chatMessageIdFor(seed, "card"), conversationId, sender: "system", orderId: invoice.orderId, invoiceId: invoice.id, createdAt: new Date(at) },
  });
  if (ask) {
    await db.chatMessage.create({
      data: { id: chatMessageIdFor(seed, "question"), conversationId, sender: "staff", staffId: null, body: INVOICE_COPY.question, invoiceId: invoice.id, createdAt: new Date(at + 1) },
    });
  }
  await db.chatMessage.updateMany({ where: { invoice: { orderId: invoice.orderId }, invoiceId: { not: invoice.id } }, data: { updatedAt: new Date(at) } });
  await db.chatConversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date(at + 1), lastMessagePreview: `Invoice ${invoice.number}`, customerUnreadCount: { increment: 1 } },
  });
}

/** Sends an invoice that already exists into the order's chat. Without a chat nothing is posted. */
export async function postInvoice(invoiceId: string): Promise<{ posted: boolean }> {
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { id: true, number: true, version: true, askConfirm: true, orderId: true } });
  const conversationId = await conversationForOrder(invoice.orderId);
  if (!conversationId) return { posted: false };
  await prisma.$transaction((tx) => writeInvoiceMessages(tx, invoice, conversationId), TX);
  await announce(conversationId, EVENTS.message, { inbox: true });
  return { posted: true };
}

/**
 * The team's Send: the order's next invoice and its chat messages, all or nothing, so a database blink
 * can't leave an invoice that never reached the chat. Orders without a chat just get the invoice.
 */
export async function issueInvoice(orderId: string, sentById: string | null): Promise<{ number: string; posted: boolean }> {
  const run = () =>
    prisma.$transaction(async (tx) => {
      const invoice = await createInvoice(orderId, { sentById }, tx);
      const conversationId = await conversationForOrder(orderId, tx);
      if (conversationId) await writeInvoiceMessages(tx, { ...invoice, orderId }, conversationId);
      return { number: invoice.number, conversationId };
    }, TX);
  let result;
  try {
    result = await run();
  } catch (error) {
    // Two sends at once picked the same version number: the loser goes again with the next one.
    const target = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" ? JSON.stringify(error.meta ?? {}) : "";
    if (!/version|Invoice/i.test(target)) throw error;
    result = await run();
  }
  if (result.conversationId) await announce(result.conversationId, EVENTS.message, { inbox: true });
  return { number: result.number, posted: Boolean(result.conversationId) };
}

/**
 * The customer's answer to "is everything correct?": their own message plus the automatic reply.
 * Only on the order's newest invoice, only in their own chat, and only once (a double tap answers once).
 */
export async function answerInvoice(actor: Actor, input: { invoiceId: string; answer: "confirmed" | "disputed" }): Promise<ChatMessageDTO[]> {
  if (actor.kind !== "customer") throw new ChatError("FORBIDDEN");
  if (input.answer !== "confirmed" && input.answer !== "disputed") throw new ChatError("INVALID");
  const invoice = await prisma.invoice.findUnique({
    where: { id: String(input.invoiceId) },
    select: {
      id: true,
      version: true,
      askConfirm: true,
      order: { select: { status: true, invoices: { orderBy: { version: "desc" }, take: 1, select: { version: true } } } },
      messages: { where: { conversationId: actor.conversationId, sender: "staff" }, take: 1, select: { id: true } },
    },
  });
  if (!invoice) throw new ChatError("NOT_FOUND");
  const latest = invoice.order.invoices[0]?.version === invoice.version;
  // Only while payment is due: once paid there's nothing left to confirm.
  if (!invoice.messages.length || !latest || !invoice.askConfirm || invoice.order.status !== "pending_payment") throw new ChatError("FORBIDDEN");

  const now = new Date();
  const yes = input.answer === "confirmed";
  const ids = [chatMessageIdFor(invoice.id, "answer"), chatMessageIdFor(invoice.id, "reply")];
  const conversationId = actor.conversationId;
  // All or nothing: the answer, the customer's message, the reply and the team alert land together.
  const answered = await prisma.$transaction(async (tx) => {
    const claimed = await tx.invoice.updateMany({ where: { id: invoice.id, answer: null }, data: { answer: input.answer, answeredAt: now } });
    if (!claimed.count) return false; // answered already, by another tap or tab
    await tx.chatMessage.create({
      data: { id: ids[0], conversationId, sender: "customer", body: yes ? INVOICE_COPY.yesMessage : INVOICE_COPY.noMessage, createdAt: now },
    });
    await tx.chatMessage.create({
      data: { id: ids[1], conversationId, sender: "staff", staffId: null, body: yes ? INVOICE_COPY.yesReply : INVOICE_COPY.noReply, createdAt: new Date(now.getTime() + 1) },
    });
    // The invoice and its question now show the answer.
    await tx.chatMessage.updateMany({ where: { invoiceId: invoice.id }, data: { updatedAt: now } });
    await tx.chatConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date(now.getTime() + 1), lastMessagePreview: yes ? "Invoice confirmed" : "Invoice: something's wrong", staffUnreadCount: { increment: 1 } },
    });
    return true;
  }, TX);
  if (!answered) return [];
  await announce(conversationId, EVENTS.message, { inbox: true });
  const rows = await prisma.chatMessage.findMany({ where: { id: { in: ids } }, orderBy: { createdAt: "asc" }, select: messageSelect });
  return rows.map((r) => toDTO(r, actor));
}

/** After an order's status changes: its invoices re-render with the new badge in every open chat. */
export async function refreshInvoiceMessages(orderId: string): Promise<void> {
  const rows = await prisma.chatMessage.findMany({ where: { invoice: { orderId } }, distinct: ["conversationId"], select: { conversationId: true } });
  if (!rows.length) return;
  await prisma.chatMessage.updateMany({ where: { invoice: { orderId } }, data: { updatedAt: new Date() } });
  await Promise.all(rows.map((r) => announce(r.conversationId, EVENTS.message)));
}

/** The order card and welcome get ids made from the order, so two attempts can't both add them. */
const orderMessageId = (orderId: string, part: "card" | "welcome") => chatMessageIdFor(orderId, part);

/**
 * A message id made from what it is for (an order, an invoice version, an answer), so a retry or a
 * second attempt can never add the same message twice.
 */
export function chatMessageIdFor(seed: string, part: string) {
  const h = createHash("sha256").update(`chat-order:${seed}:${part}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16]!, 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

async function upsertConversation(tokenHash: string, order: { customerId: string | null; fullName: string; email: string }) {
  const details = { customerId: order.customerId, customerName: order.fullName, customerEmail: order.email };
  const args = { where: { deviceTokenHash: tokenHash }, create: { deviceTokenHash: tokenHash, ...details }, update: details, select: { id: true } };
  try {
    return await prisma.chatConversation.upsert(args);
  } catch (error) {
    // Two first orders from one device at once: the other insert won, so update that one.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return prisma.chatConversation.upsert(args);
    throw error;
  }
}

/**
 * Makes sure every order this device placed has its chat card. Normally the checkout adds it; if that
 * step failed (the database blinked), the next status check from the store puts it right.
 * Orders found by email on another device never open a chat.
 */
export async function ensureOrderChats(tokenHash: string): Promise<void> {
  const access = await prisma.orderAccess.findMany({
    where: { tokenHash, fullDetails: true },
    orderBy: { createdAt: "asc" },
    select: { order: { select: { id: true, number: true, totalCents: true, paymentMethod: true, customerId: true, fullName: true, email: true } } },
  });
  if (!access.length) return;
  const carded = await prisma.chatMessage.findMany({
    where: { orderId: { in: access.map((a) => a.order.id) }, sender: "system" },
    select: { orderId: true },
  });
  const has = new Set(carded.map((m) => m.orderId));
  for (const { order } of access) if (!has.has(order.id)) await openOrderConversation(tokenHash, order);
}
